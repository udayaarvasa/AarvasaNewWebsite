import assert from "node:assert/strict"
import test from "node:test"
import { POST as mobileSignup } from "../src/app/api/mobile/auth/register/route.ts"
import { POST as webSignup } from "../src/app/api/auth/signup/route.ts"
import { googleControlsEmail } from "../src/lib/google-email-ownership.ts"

test("legacy signup callers cannot create a password account or receive tokens", async () => {
  const payload = { name: "Test Buyer", email: "buyer@example.test", password: "test-password-only" }
  for (const handler of [mobileSignup, webSignup]) {
    const request = new Request("https://example.test", { method: "POST", body: JSON.stringify(payload) })
    const response = await Reflect.apply(handler, undefined, [request])
    assert.equal(response.status, 403)
    const body = await response.json()
    assert.equal(body.accessToken, undefined)
    assert.equal(body.user, undefined)
    assert.match(body.error ?? body.message, /verified Google/i)
  }
})

test("only a verified email hosted by Google proves mailbox ownership", () => {
  assert.equal(googleControlsEmail("buyer@gmail.com", true, undefined), true)
  assert.equal(googleControlsEmail("buyer@example.test", true, "example.test"), true)
  assert.equal(googleControlsEmail("buyer@gmail.com", false, undefined), false)
  assert.equal(googleControlsEmail("buyer@example.test", true, undefined), false)
  assert.equal(googleControlsEmail("buyer@example.test", true, " "), false)
})
