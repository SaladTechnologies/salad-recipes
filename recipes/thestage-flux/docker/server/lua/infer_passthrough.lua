ngx.req.read_body()
local data = ngx.req.get_body_data()
if not data then
  local fpath = ngx.req.get_body_file()
  if fpath then
    local fh = io.open(fpath, "rb")
    if fh then data = fh:read("*a"); fh:close() end
  end
end
data = data or ""

local res = ngx.location.capture("/_internal_proxy_cli/" .. ngx.var.model_name, {
  method = ngx.HTTP_POST,
  body = data,
  headers = {
    ["Content-Type"] = ngx.var.http_content_type or "application/json",
    ["Accept"] = "application/octet-stream",
    ["Accept-Encoding"] = "identity",
    ["Authorization"] = ngx.var.http_authorization
  }
})

local rb = res.body or ""
ngx.status = res.status
if res.header then
  for k, v in pairs(res.header) do ngx.header[k] = v end
end
ngx.print(rb)
