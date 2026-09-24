export default async function handler(req, res) {
  const checkedAt = new Date().toISOString();

  return res.status(200).json({
    ok: true,
    service: "Hornet Alert UK",
    message: "Automatic source checker is running.",
    checkedAt
  });
}
