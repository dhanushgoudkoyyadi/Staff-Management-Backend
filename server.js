const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const Salary = require("./models/salary-schema"); // Import the salary schema

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
  .then(() => {
    console.log("Database connected successfully!");
  })
  .catch((error) => {
    console.error("Database connection error:", error);
  });

// Route to Add Salary Data
app.post("/addsalary", async (req, res) => {
  try {
    const salary = new Salary(req.body);
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
    const salaries = await Salary.find();
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
