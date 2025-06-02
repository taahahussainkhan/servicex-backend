import bcrypt from "bcryptjs";

async function generateHash() {
  const hashed = await bcrypt.hash("taaha123", 10);
  console.log("Hashed password:", hashed);
}

generateHash();
$2b$10$YFnfLb0xshcJTZE/qIiVPuytpPQ6Bx1hjng3Wvy5Ra4OLgiYp1HSK