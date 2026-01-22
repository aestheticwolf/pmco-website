// server.js
const express = require('express');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Ensure uploads folder exists
const UPLOADS_DIR = './uploads';
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files allowed'), false);
    }
  }
});

const Contact = require('./models/Contact');
const Product = require('./models/Product');
const Service = require('./models/Service');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'pmco_fallback_secret';

app.use(express.json());
app.use(cors());

// Disable caching for admin routes
app.use((req, res, next) => {
  if (req.path.startsWith('/api/admin/')) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
  next();
});

app.use(express.static('.'));
app.use('/uploads', express.static('./uploads'));

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// ===== ADMIN AUTHENTICATION =====
app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body;

  if (
    email === process.env.ADMIN_EMAIL &&
    password === process.env.ADMIN_PASSWORD
  ) {
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
    return res.json({ success: true, token });
  }

  return res.status(401).json({ error: 'Invalid credentials' });
});

// Middleware to protect admin routes
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' });
    }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

// ===== ADMIN: Manage Products =====
app.get('/api/admin/products', authenticateAdmin, async (req, res) => {
  try {
    const products = await Product.find().sort({ submittedAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

app.post('/api/admin/products', authenticateAdmin, async (req, res) => {
  try {
    const { title, description, imageUrl } = req.body;
    const product = new Product({ title, description, imageUrl });
    await product.save();
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ error: 'Invalid product data' });
  }
});

// Upload image
app.post('/api/admin/upload', authenticateAdmin, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.json({ imageUrl: '/uploads/' + req.file.filename });
});

// NEW: Get single product
app.get('/api/admin/products/:id', authenticateAdmin, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// NEW: Update product
app.put('/api/admin/products/:id', authenticateAdmin, async (req, res) => {
  try {
    const { title, description, imageUrl } = req.body;
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { title, description, imageUrl },
      { new: true, runValidators: true }
    );
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(400).json({ error: 'Invalid update data' });
  }
});

// NEW: Delete product
app.delete('/api/admin/products/:id', authenticateAdmin, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ success: true, message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// ===== ADMIN: Manage Services =====
app.get('/api/admin/services', authenticateAdmin, async (req, res) => {
  try {
    const services = await Service.find().sort({ submittedAt: -1 });
    res.json(services);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

app.post('/api/admin/services', authenticateAdmin, async (req, res) => {
  try {
    const { title, description, icon } = req.body;
    const service = new Service({ title, description, icon });
    await service.save();
    res.status(201).json(service);
  } catch (err) {
    res.status(400).json({ error: 'Invalid service data' });
  }
});

// NEW: Get single service
app.get('/api/admin/services/:id', authenticateAdmin, async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ error: 'Service not found' });
    res.json(service);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch service' });
  }
});

// NEW: Update service
app.put('/api/admin/services/:id', authenticateAdmin, async (req, res) => {
  try {
    const { title, description, icon } = req.body;
    const service = await Service.findByIdAndUpdate(
      req.params.id,
      { title, description, icon },
      { new: true, runValidators: true }
    );
    if (!service) return res.status(404).json({ error: 'Service not found' });
    res.json(service);
  } catch (err) {
    res.status(400).json({ error: 'Invalid update data' });
  }
});

// NEW: Delete service
app.delete('/api/admin/services/:id', authenticateAdmin, async (req, res) => {
  try {
    const service = await Service.findByIdAndDelete(req.params.id);
    if (!service) return res.status(404).json({ error: 'Service not found' });
    res.json({ success: true, message: 'Service deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete service' });
  }
});

// ===== ADMIN: Manage Contacts =====
app.get('/api/admin/contacts', authenticateAdmin, async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ submittedAt: -1 });
    res.json(contacts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

app.put('/api/admin/contacts/:id', authenticateAdmin, async (req, res) => {
  try {
    const { actionRemark } = req.body;
    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      { actionRemark },
      { new: true }
    );
    if (!contact) return res.status(404).json({ error: 'Contact not found' });
    res.json(contact);
  } catch (err) {
    res.status(400).json({ error: 'Invalid update data' });
  }
});

// Delete contact
app.delete('/api/admin/contacts/:id', authenticateAdmin, async (req, res) => {
  try {
    const contact = await Contact.findByIdAndDelete(req.params.id);
    if (!contact) return res.status(404).json({ error: 'Contact not found' });
    res.json({ success: true, message: 'Contact deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

// ===== PUBLIC API: For Frontend =====
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find().sort({ submittedAt: -1 });
    res.json(products);
  } catch (err) {
    console.error('Products fetch error:', err);
    res.status(500).json([]);
  }
});

app.get('/api/services', async (req, res) => {
  try {
    const services = await Service.find().sort({ submittedAt: -1 });
    res.json(services);
  } catch (err) {
    console.error('Services fetch error:', err);
    res.status(500).json([]);
  }
});

// ===== CONTACT FORM WITH IP CAPTURE =====
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, phone, interest, message } = req.body;

    // Get client IP address
    let ipAddress = req.headers['x-forwarded-for'] || 
                   req.connection.remoteAddress || 
                   req.socket.remoteAddress ||
                   (req.connection.socket ? req.connection.socket.remoteAddress : '');
    
    // Clean up IPv6 localhost
    if (ipAddress === '::1' || ipAddress === '::ffff:127.0.0.1') {
      ipAddress = '127.0.0.1';
    }

    // Validate required fields
    if (!name || !email || !phone || !interest || !message) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    // Email validation
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    // Phone validation
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      return res.status(400).json({ error: 'Please enter a valid phone number (10–15 digits).' });
    }

    // Save to MongoDB with IP address
    const contact = new Contact({ 
      name, 
      email, 
      phone, 
      interest, 
      message,
      ipAddress: ipAddress.toString()
    });
    await contact.save();

    // Send email with IP included
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS
      }
    });

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: process.env.GMAIL_USER,
      subject: `New Consultation Request from ${name}`,
      html: `
        <h2>New Consultation Booking</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Interest:</strong> ${interest}</p>
        <p><strong>Message:</strong><br/>${message}</p>
        <p><strong>IP Address:</strong> ${ipAddress}</p>
        <hr>
        <p><em>Submitted on: ${new Date().toLocaleString()}</em></p>
      `
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ success: true, message: 'Thank you! We’ll contact you shortly.' });

  } catch (error) {
    console.error('Submission error:', error);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// Fallback route
app.get('/*splat', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});