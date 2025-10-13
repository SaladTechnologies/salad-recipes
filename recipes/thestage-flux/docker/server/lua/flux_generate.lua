local cjson = require "cjson.safe"

local function le_u32(s)
  local b1,b2,b3,b4 = s:byte(1,4)
  return b1 + b2*256 + b3*65536 + b4*16777216
end

local function find_json_end(buf)
  if #buf == 0 or buf:byte(1) ~= string.byte("{") then
    return nil, "Body doesn't start with '{'"
  end
  local depth, in_str, esc = 0, false, false
  for i = 1, #buf do
    local c = buf:byte(i)
    if in_str then
      if esc then esc = false
      elseif c == 92 then esc = true           -- '\'
      elseif c == 34 then in_str = false       -- '"'
      end
    else
      if c == 34 then in_str = true            -- '"'
      elseif c == 123 then depth = depth + 1   -- '{'
      elseif c == 125 then                      -- '}'
        depth = depth - 1
        if depth == 0 then return i end
      end
    end
  end
  return nil, "JSON header not terminated"
end

local function pad_riff_if_needed(data)
  if #data >= 12 and data:sub(1,4) == "RIFF" and data:sub(9,12) == "WEBP" then
    local declared_total = le_u32(data:sub(5,8)) + 8
    if declared_total > #data then
      return data .. string.rep("\0", declared_total - #data)
    end
  end
  return data
end

local function sniff_ct(b)
  if #b >= 12 and b:sub(1,4) == "RIFF" and b:sub(9,12) == "WEBP" then return "image/webp" end
  if #b >= 8 and b:sub(1,8) == "\137PNG\r\n\26\n" then return "image/png" end
  if #b >= 3 and b:sub(1,3) == "\255\216\255" then return "image/jpeg" end
  return "application/octet-stream"
end

local function sanitize_header_value(s)
  return (s:gsub("[\r\n]", " "))
end

ngx.req.read_body()
local req_body = ngx.req.get_body_data()
if not req_body then
  local fpath = ngx.req.get_body_file()
  if fpath then
    local fh = io.open(fpath, "rb")
    if fh then req_body = fh:read("*a"); fh:close() end
  end
end
if not req_body then return ngx.exit(400) end

local payload = cjson.decode(req_body)
if not payload then return ngx.exit(400) end
local prompt = tostring(payload.prompt or payload.pos_prompt or "")
local seed = tonumber(payload.seed) or 123
local aspect_ratio = tostring(payload.aspect_ratio or "")
local guidance_scale = tonumber(payload.guidance_scale) or 0.0
local num_inference_steps = tonumber(payload.num_inference_steps) or 0
if prompt == "" then return ngx.exit(400) end

local hdrs = ngx.req.get_headers()
local model_name = hdrs["X-Model-Name"] or "flux-1-schnell-s-bs2"

local triton_payload = {
  model_name = model_name,
  parameters = { binary_data_output = true },
  inputs = {
    { name = "pos_prompt", datatype = "BYTES",  shape = {1,1}, data = { prompt } },
    { name = "seed", datatype = "UINT32", shape = {1,1}, data = { seed } },
    { name = "aspect_ratio", datatype = "BYTES", shape = {1,1}, data = { aspect_ratio } },
    { name = "guidance_scale", datatype = "FP32", shape = {1,1}, data = { guidance_scale } },
    { name = "num_inference_steps", datatype = "UINT32", shape = {1,1}, data = { num_inference_steps } }
  },
  outputs = {
    { name = "image", parameters = { binary_data = true } },
    { name = "metadata", parameters = { binary_data = true } }
  }
}
local triton_json = cjson.encode(triton_payload)

local res = ngx.location.capture("/_internal_proxy_cli/" .. model_name, {
  method = ngx.HTTP_POST,
  body = triton_json,
  headers = {
    ["Content-Type"] = "application/json",
    ["Accept"] = "application/octet-stream",
    ["Accept-Encoding"] = "identity",
    ["Authorization"] = ngx.var.http_authorization
  }
})

if not res then
  ngx.status = 502; ngx.say("upstream error"); return
end
if res.status ~= 200 then
  ngx.status = res.status; ngx.print(res.body or ""); return
end

local rb = res.body or ""

local hdr_len = nil
if res.header then
  hdr_len = res.header["inference-header-content-length"] or res.header["Inference-Header-Content-Length"]
  if hdr_len then hdr_len = tonumber(hdr_len) end
end

local header_json, tail
if hdr_len and #rb >= hdr_len then
  header_json = rb:sub(1, hdr_len)
  tail = rb:sub(hdr_len + 1)
else
  local idx = select(1, find_json_end(rb))
  if not idx then
    ngx.status = 502; ngx.say("bad triton header"); return
  end
  header_json = rb:sub(1, idx)
  tail = rb:sub(idx + 1)
end

local header = cjson.decode(header_json)
if not header or not header.outputs then
  ngx.status = 502; ngx.say("bad triton header json"); return
end

local offset = 1
local image_payload, metadata_payload
for _, out in ipairs(header.outputs) do
  local params = out.parameters or {}
  local size = params.binary_data_size
  if not size or size <= 0 then
    ngx.status = 502; ngx.say("missing binary_data_size"); return
  end
  local chunk = tail:sub(offset, offset + size - 1)
  if #chunk ~= size then
    ngx.status = 502; ngx.say("truncated chunk"); return
  end
  if #chunk < 4 then
    ngx.status = 502; ngx.say("chunk too small"); return
  end
  local elem_len = le_u32(chunk:sub(1,4))
  local payload = chunk:sub(5, 4 + elem_len)
  if #payload ~= elem_len then
    ngx.status = 502; ngx.say("BYTES length mismatch"); return
  end
  if out.name == "image" then image_payload = payload end
  if out.name == "metadata" then metadata_payload = payload end
  offset = offset + size
end

if not image_payload then
  ngx.status = 502; ngx.say("no image payload"); return
end

image_payload = pad_riff_if_needed(image_payload)

if metadata_payload and #metadata_payload > 0 then
  ngx.header["X-Image-Metadata"] = sanitize_header_value(metadata_payload)
end

ngx.header["Cache-Control"] = "no-store"
ngx.header["Content-Type"] = sniff_ct(image_payload)
ngx.print(image_payload)
