local expected = os.getenv("AUTH_TOKEN")
if expected and expected ~= "" then
  local h = ngx.var.http_Authorization
  if not h then return ngx.exit(401) end
  local token = h:match("^Bearer%s+(.+)$")
  if token ~= expected then return ngx.exit(401) end
end
