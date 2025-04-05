const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { Staff } = require("./models/salary-schema");

const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Database Connection
const DB_URL = "mongodb+srv://akshaya:mongo123@cluster0.7muo0.mongodb.net/akshaya";
mongoose
  .connect(DB_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Database connected successfully!"))
  .catch((error) => console.error("Database connection error:", error));

const JWT_SECRET = "your_jwt_secret_key";

// Middleware to Authenticate Token
const authenticateToken = (req, res, next) => {
  const authHeader = req.header("Authorization");
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(401).json({ message: "Unauthorized access" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    req.user = user;
    next();
  });
};

// File Upload Configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath =
      file.fieldname === "profilePhoto" ? "uploads/profiles/" : "uploads/documents/";
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.fieldname === "profilePhoto" && !file.mimetype.startsWith("image/")) {
    return cb(new Error("Profile photo must be an image file"), false);
  }
  if (
    file.fieldname === "identificationDocs" &&
    !["image/", "application/pdf"].some((type) => file.mimetype.startsWith(type))
  ) {
    return cb(new Error("Identification documents must be images or PDFs"), false);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit to 5 MB
});

// Error Handler for Multer
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ message: "File too large. Maximum size is 5 MB." });
  }
  if (err) {
    return res.status(400).json({ message: err.message });
  }
  next();
});

// Route to Add Employee Details
app.post(
  "/employees/:userId",
  upload.fields([{ name: "profilePhoto", maxCount: 1 }, { name: "identificationDocs", maxCount: 5 }]),
  async (req, res) => {
    try {
      const userId = req.params.userId;

      // Find the user in the database
      const user = await Staff.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      // Extract file paths from the uploaded files
      const profilePhotoPath = req.files?.profilePhoto?.[0]?.path || "";
      const identificationDocPaths = req.files?.identificationDocs?.map((file) => file.path) || [];

      // Create employee details object
      const employeeDetails = {
        fullName: req.body.fullName,
        dateOfBirth: req.body.dateOfBirth,
        gender: req.body.gender,
        address: req.body.address,
        phone: req.body.phone,
        email: req.body.email,
        emergencyContact: {
          name: req.body.emergencyContactName,
          relationship: req.body.emergencyContactRelation,
          phone: req.body.emergencyContactPhone,
        },
        profilePhoto: profilePhotoPath,
        identificationDocs: identificationDocPaths,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: "active",
      };

      // Assign employee details to the user
      user.employeeDetails = employeeDetails;

      // Save the updated user to the database
      await user.save();

      res.status(201).json({
        success: true,
        message: "Employee details saved successfully",
        data: user,
      });
    } catch (error) {
      console.error("Error saving employee details:", error);
      res.status(500).json({
        success: false,
        message: "Failed to save employee details",
        error: error.message,
      });
    }
  }
);

// Route to Fetch All Employees
app.get("/employees", async (req, res) => {
  try {
    const employees = await Staff.find({ employeeDetails: { $exists: true } }).select(
      "username email mobilenumber employeeDetails -_id"
    );

    res.status(200).json({ success: true, count: employees.length, data: employees });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error retrieving employees", error: error.message });
  }
});

// Route to Fetch Employee by User ID
app.get("/employees/:userId", async (req, res) => {
  try {
    const user = await Staff.findById(req.params.userId).select("-password");
    if (!user || !user.employeeDetails) {
      return res.status(404).json({ success: false, message: "Employee details not found" });
    }

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error retrieving employee details", error: error.message });
  }
});

// Route to Add Salary Data
app.post("/addsalary", async (req, res) => {
  try {
    const salary = new Staff(req.body);
    await salary.save();
    res.status(201).json({ message: "Salary saved successfully!", data: salary });
  } catch (error) {
    console.error("Error saving salary:", error);
    res.status(400).json({ error: "Failed to save salary data." });
  }
});

// Route to Fetch Salary Data and Calculate Net Salary
app.get("/getsalary", async (req, res) => {
  try {
    const salaries = await Staff.find();
    const salaryDataWithNetSalary = salaries.map((salary) => {
      const basicPay = salary.basicPay;
      const allowances = salary.allowances.hra + salary.allowances.da + salary.allowances.travel;
      const deductions = salary.deductions.pf + salary.deductions.tax + salary.deductions.loans;

      const netSalary = basicPay + allowances - deductions;

      return {
        ...salary._doc, // Spread the existing salary object
        netSalary, // Add the calculated Net Salary
      };
    });

    res.status(200).json(salaryDataWithNetSalary);
  } catch (error) {
    console.error("Error fetching salaries:", error);
    res.status(500).json({ error: "Failed to fetch salary data." });
  }
});

const PORT = 6788;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});