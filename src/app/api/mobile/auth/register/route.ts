// Older app builds still call this endpoint. Fail before processing credentials.
export function POST() {
  return Response.json(
    { success: false, code: "VERIFIED_SIGNUP_REQUIRED", error: "To create an account, continue with a verified Google account." },
    { status: 403 }
  )
}
