export async function assertOk(res: Response): Promise<void> {
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
}