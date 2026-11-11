// Reject direct password signups, including requests from cached forms.
export function POST() {
  return Response.json(
    { message: "To create an account, continue with a verified Google account." },
    { status: 403 }
  )
}
