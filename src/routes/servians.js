import express from "express";
const router = express.Router();



const servians = [
  {
    id: 1,
    name: "Daud Irfan",
    profilePicture: "/img.jpg",
    images: ["/img.jpg", "/img.jpg", "/img.jpg"],
    service: "Wedding Photography",
    level: "Professional",
    timing: "9 AM - 5 PM",
    availability: "Weekends",
    location: "Lahore, Pakistan",
    phone: "+92 300 1234567",
    verified: true,
  },
  {
    id: 2,
    name: "Akram Bakhtyar",
    profilePicture: "/img.jpg",
    images: ["/img.jpg", "/img.jpg", "/img.jpg"],
    service: "Plumber",
    level: "Professional",
    timing: "9 AM - 5 PM",
    availability: "Weekends",
    location: "Lahore, Pakistan",
    phone: "+92 300 1234567",
    verified: true,
  },
];

const servianListing = [
  {
    id: 1,
    servian: "Daud Irfan",
    service: "Wedding Photography",
    description: "Full-day wedding shoot with two photographers.",
    price: "$1200",
    location: "Lahore, Pakistan",
    image: "/img.jpg",
  },
  {
    id: 2,
    servian: "Ali Khan",
    service: "Birthday Event",
    description: "Theme decoration and photography included.",
    price: "$600",
    location: "Karachi, Pakistan",
    image: "/img.jpg",
  },
];





router.get("/", async (req, res) => {
  try {
    const servianListings = await prisma.servianListing.findMany({
      include: {
        servian: true,  
      },
    });

    res.json(servianListings); 
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server Error" });
  }
});






router.get("/:id", async (req, res) => {
  const { id } = req.params;
  console.log("Hit GET /:id route with ID:", req.params.id);
  try {
    const servian = await prisma.servian.findUnique({
        where: {id: parseInt(id)}
    })

    if (!servian) return res.status(404).json({ message: "Not Found!" });

    res.json(servian);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server Error" });
  }
});


export default router;