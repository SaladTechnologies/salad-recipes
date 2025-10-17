ngx.header["Content-Type"] = "application/json"

local res = ngx.location.capture("/_triton_repository_index")
if not res or res.status >= 400 then
  ngx.status = 503
  ngx.say('{"success": false, "error": "model check failed"}')
  return
end

local ok, models = pcall(require("cjson").decode, res.body)
if not ok then
  ngx.status = 503
  ngx.say('{"success": false, "error": "JSON parse failed"}')
  return
end

for _, m in ipairs(models) do
  if m.state ~= "READY" then
    ngx.status = 503
    ngx.say('{"success": false, "error": "model not ready"}')
    return
  end
end

ngx.status = 200
ngx.say('{"success": true}')
