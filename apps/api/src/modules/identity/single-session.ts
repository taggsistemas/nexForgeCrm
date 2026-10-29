// MongoDB's unique _id is the concurrency boundary. Every principal writes its
// own fixed session slot; replacing the token invalidates the previous login.
export async function replaceSingleSession(write: () => Promise<unknown>) {
  try { await write(); }
  catch(error) {
    if ((error as {code?:number}).code !== 11000) throw error;
    // Two first logins can race on upsert. Retry against the slot just created.
    await write();
  }
}
