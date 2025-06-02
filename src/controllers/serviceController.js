import Service from "../models/serviceModel.js";


export const createService = async (req, res) => {
  try {
    const service = await Service.create({
      ...req.body,
      servian: req.user._id, 
    });

    res.status(201).json(service);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create service" });
  }
};


export const getServices = async (req, res) => {
  try {
    const services = await Service.find({}).populate("servian", "name email");
    res.json(services);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch services" });
  }
};


export const getServiceById = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id).populate("servian", "name email");

    if (!service) return res.status(404).json({ message: "Service not found" });

    res.json(service);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch service" });
  }
};
