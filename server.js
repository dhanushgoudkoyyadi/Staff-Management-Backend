const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

mongoose.connect('mongodb+srv://dhanush:L8Xm0Ye8kO97lVop@cluster0.lecdq.mongodb.net/backend', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const JWT_SECRET = 'your_jwt_secret_key';

// Define Staff Schema with Employee Details Embedded
const staffSchema = new mongoose.Schema({
    username: { type: String, required: true },
    password: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    mobilenumber: { type: Number, required: true },
    gender: { type: String, required: true },
    employeeDetails: {
        fullName: String,
        dateOfBirth: Date,
        gender: String,
        address: String,
        phone: String,
        email: String,
        emergencyContact: {
            name: String,
            relationship: String,
            phone: String
        },
        profilePhoto: String,
        identificationDocs: [String],
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
        status: { type: String, enum: ['active', 'inactive', 'pending', 'terminated'], default: 'pending' }
    }
});

const Staff = mongoose.model("Staff", staffSchema);

// Middleware for JWT authentication
const authenticateToken = (req, res, next) => {
    const authHeader = req.header('Authorization');
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'Unauthorized access' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'Invalid token' });
        req.user = user;
        next();
    });
};

// User Registration
app.post('/register', async (req, res) => {
    try {
        const { username, password, email, mobilenumber, gender } = req.body;

        if (!username || !password || !email || !mobilenumber || !gender) {
            return res.status(400).json({ message: 'All Fields are required' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new Staff({ username, password: hashedPassword, email, mobilenumber, gender });

        await user.save();
        const token = jwt.sign({ id: user._id, username }, JWT_SECRET, { expiresIn: '1h' });

        res.json({ token, userId: user._id });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ message: 'Server error. Please try again.' });
    }
});

// User Login
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await Staff.findOne({ username });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user._id, username }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ token, userId: user._id });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error. Please try again.' });
    }
});

// File Upload Configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = file.fieldname === 'profilePhoto' ? 'uploads/profiles/' : 'uploads/documents/';
        fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

const fileFilter = (req, file, cb) => {
    if (file.fieldname === 'profilePhoto' && !file.mimetype.startsWith('image/')) {
        return cb(new Error('Profile photo must be an image file'), false);
    }
    if (file.fieldname === 'identificationDocs' && !['image/', 'application/pdf'].some(type => file.mimetype.startsWith(type))) {
        return cb(new Error('Identification documents must be images or PDFs'), false);
    }
    cb(null, true);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

// Add Employee Details to a User
app.post('/employees/:userId', 
    upload.fields([{ name: 'profilePhoto', maxCount: 1 }, { name: 'identificationDocs', maxCount: 5 }]), 
    async (req, res) => {
        try {
            const userId = req.params.userId;
            const user = await Staff.findById(userId);
            if (!user) return res.status(404).json({ success: false, message: 'User not found' });

            const profilePhotoPath = req.files?.profilePhoto?.[0]?.path;
            const identificationDocPaths = req.files?.identificationDocs?.map(file => file.path) || [];

            user.employeeDetails = {
                fullName: req.body.fullName,
                dateOfBirth: req.body.dateOfBirth,
                gender: req.body.gender,
                address: req.body.address,
                phone: req.body.phone,
                email: req.body.email,
                emergencyContact: {
                    name: req.body.emergencyContactName,
                    relationship: req.body.emergencyContactRelation,
                    phone: req.body.emergencyContactPhone
                },
                profilePhoto: profilePhotoPath,
                identificationDocs: identificationDocPaths,
                createdAt: new Date(),
                updatedAt: new Date(),
                status: 'active'
            };

            await user.save();

            res.status(201).json({
                success: true,
                message: 'Employee details added successfully',
                data: user
            });
        } catch (error) {
            console.error('Error registering employee:', error);
            res.status(500).json({
                success: false,
                message: 'Error registering employee',
                error: error.message
            });
        }
    }
);

// Get All Employees
app.get('/employees', async (req, res) => {
    try {
        const employees = await Staff.find({ employeeDetails: { $exists: true } })
            .select('username email mobilenumber employeeDetails -_id');

        res.status(200).json({ success: true, count: employees.length, data: employees });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error retrieving employees', error: error.message });
    }
});

// Get Employee by User ID
app.get('/employees/:userId', async (req, res) => {
    try {
        const user = await Staff.findById(req.params.userId).select('-password');
        if (!user || !user.employeeDetails) {
            return res.status(404).json({ success: false, message: 'Employee details not found' });
        }

        res.status(200).json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error retrieving employee details', error: error.message });
    }
});

const PORT = 6788;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
