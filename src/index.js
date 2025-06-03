import express from "express";
import cors from "cors";
import dotenv from "dotenv";
// import servianRoutes from "./routes/servians.js"; 
import errorHandling from "./middlewares/errorHandler.js";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import serviceRoutes from "./routes/serviceRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
 import customerRoutes from "./routes/customerRoutes.js";
 import servianRoutes from "./routes/servianRoutes.js";

const app = express();
dotenv.config()

connectDB()

//------------------------------------ Middleware
app.use(express.json());
app.use(cors());

//------------------------------------ Routes
app.use('/api/auth',authRoutes)
// app.use('/api/servians',servianRoutes)
app.use('/api/services',serviceRoutes)
app.use('/api/admin',adminRoutes)
app.use('/api/customer',customerRoutes)
app.use('/api/servian',servianRoutes)

app.use(errorHandling);
//-------------------------------------Test




const PORT = process.env.PORT ;

app.listen(PORT, () =>
  console.log(`Backend running on http://localhost:${PORT}`)
);
