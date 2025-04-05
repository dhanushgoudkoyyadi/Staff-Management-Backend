const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Employee Schema (Embedded inside Staff Schema)
const EmployeeSchema = new Schema({
    fullName: {
        type: String,
        required: [true, 'Full name is required']
    },
    dateOfBirth: {
        type: Date,
        required: [true, 'Date of birth is required'],
        validate: {
            validator: function (value) {
                return value <= new Date();
            },
            message: 'Date of birth cannot be in the future'
        }
    },
    gender: {
        type: String,
        required: [true, 'Gender is required'],
        enum: ['male', 'female', 'other']
    },
    address: {
        type: String,
        required: [true, 'Address is required']
    },
    phone: {
        type: String,
        required: [true, 'Phone number is required'],
        match: [/^[0-9]{10}$/, 'Phone number must be 10 digits']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email address'],
        unique: true,
        lowercase: true,
        trim: true
    },
    emergencyContact: {
        name: {
            type: String,
            required: [true, 'Emergency contact name is required']
        },
        relationship: {
            type: String,
            required: [true, 'Relationship is required']
        },
        phone: {
            type: String,
            required: [true, 'Emergency contact phone is required'],
            match: [/^[0-9]{10}$/, 'Phone number must be 10 digits']
        }
    },
    profilePhoto: {
        type: String,
        required: [true, 'Profile photo is required']
    },
    identificationDocs: [{
        type: String,
        required: true
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'pending', 'terminated'],
        default: 'pending'
    }
});

// Middleware to update 'updatedAt' on save
EmployeeSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

// Staff Schema with Embedded Employee Document
const StaffSchema = new Schema({
    username: { type: String, required: true },
    password: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    mobilenumber: { type: Number, required: true },
    gender: { type: String, enum: ['male', 'female', 'other'], required: true },
    employeeDetails: EmployeeSchema  // Embedding Employee schema as a document
});

const Staff = mongoose.model('StaffManagement', StaffSchema);

module.exports = { Staff };
