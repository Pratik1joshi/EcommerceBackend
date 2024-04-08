require('dotenv').config();
const port = process.env.PORT || 4000;
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const BASE_URL = process.env.BASE_URL;
// const { clearScreenDown } = require("readline");

app.use(express.json());
app.use(cors());

//MongoDb connextion
const dbConnection = process.env.DB_CONNECTION;

mongoose.connect(dbConnection)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('Error connecting to MongoDB:', err));

//API creation

app.get("/", (req, res) => {
  res.send("Express App is Running");
});

//Img storage

const storage = multer.diskStorage({
  destination: "./upload/images",
  filename: (req, file, cb) => {
    return cb(
      null,
      `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`
    );
  },
});

const upload = multer({ storage: storage });

// Create upload endpoint for images
app.use("/images", express.static("upload/images"));
app.post("/upload", upload.single("product"), (req, res) => {
  res.json({
    success: 1,
    image_url: `${BASE_URL}/images/${req.file.filename}`,
  });
});

// Schema for Creating Product

const Product = mongoose.model("Product", {
  id: {
    type: Number,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  image: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: true,
  },
  new_price: {
    type: Number,
    required: true,
  },
  old_price: {
    type: Number,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  available: {
    type: Boolean,
    default: true,
  },
});

app.post("/addproduct", async (req, res) => {
  let products = await Product.find({});
  let id;
  if (products.length > 0) {
    let last_product_array = products.slice(-1);
    let last_product = last_product_array[0];
    id = last_product.id + 1;
  } else {
    id = 1;
  }
  const product = new Product({
    id: id,
    name: req.body.name,
    image: req.body.image,
    category: req.body.category,
    new_price: req.body.new_price,
    old_price: req.body.old_price,
  });
  // console.log(product);
  await product.save();
  console.log("Saved");
  res.json({
    success: true,
    name: req.body.name,
  });
});

// Creating API for delete

app.post("/removeproduct", async (req, res) => {
  await Product.findOneAndDelete({ id: req.body.id });
  console.log("Removed");
  res.json({
    success: true,
    name: req.body.name,
  });
});

// Creating API for all products

app.get("/allproducts", async (req, res) => {
  let products = await Product.find({});
  console.log("All Products Fetched");
  res.send(products);
});

//Schema for users

const User = mongoose.model("User", {
  name: {
    type: String,
  },
  email: {
    type: String,
    unique: true,
  },
  password: {
    type: String,
  },
  cartData: {
    type: Object,
  },
  date: {
    type: Date,
    defult: Date.now,
  },
});

//API for user

app.post("/signup", async (req, res) => {
  let check = await User.findOne({ email: req.body.email });
  if (check) {
    return res
      .status(400)
      .json({ success: false, error: "This email have been used" });
  }
  let cart = {};
  for (let i = 0; i < 300; i++) {
    cart[i] = 0;
  }
  const user = new User({
    name: req.body.username,
    email: req.body.email,
    password: req.body.password,
    cartData: cart,
  });

  await user.save();

  const data = {
    user: {
      id: user.id,
    },
  };

  const token = jwt.sign(data, "secret_ecom");
  res.json({ success: true, token });
});

//APi for login
app.post("/login", async (req, res) => {
  let user = await User.findOne({ email: req.body.email });
  if (user) {
    const passCompare = req.body.password === user.password;
    if (passCompare) {
      const data = {
        user: {
          id: user.id,
        },
      };
      const token = jwt.sign(data, "secret_ecom");
      res.json({ success: true, token });
    } else {
      res.json({ success: false, errors: "Wrong Password" });
    }
  } else {
    res.json({ success: false, error: "Wrong email address" });
  }
});

//creating api for new collection
app.get("/newcollections", async (req, res) => {
  let products = await Product.find({});
  let new_collection = products.slice(1).slice(-8);
  console.log("Newcollection Fetched");
  res.send(new_collection);
});

//creating popular in women
app.get("/popularinwomen", async (req, res) => {
  let products = await Product.find({ category: "women" });
  let popular_in_women = products.slice(products.length - 4, 4);
  res.send(popular_in_women);
});

//Creating middleware
const fetchUser = async (req, res, next) => {
  const token = req.header("auth-token");
  if (!token) {
    res.status(401).send({ errors: "Please login first" });
  } else {
    try {
      const data = jwt.verify(token, 'secret_ecom');
      req.user = data.user;
      next();
    } catch (error) {
      res.status(401).send({ errors: "Please authenticate" });
    }
  }
};

//cart data
app.post("/addtocart", fetchUser, async (req, res) => {
  console.log("added", req.body.itemId);
  let userData = await User.findOne({ _id: req.user.id });
  userData.cartData[req.body.itemId] += 1;
  await User.findOneAndUpdate(
    { _id: req.user.id },
    { cartData: userData.cartData }
  );
  res.send("Added");
});

// to remove cartdata
app.post("/removefromcart", fetchUser, async (req, res) => {
  console.log("removed", req.body.itemId);
  let userData = await User.findOne({ _id: req.user.id });
  if (userData.cartData[req.body.itemId] > 0)
    userData.cartData[req.body.itemId] -= 1;
  await User.findOneAndUpdate(
    { _id: req.user.id },
    { cartData: userData.cartData }
  );
  res.send("removed");
});

// getting cart data 
app.post('/getcart', fetchUser, async(req, res)=>{
  console.log("Get cart")
  let userData= await User.findOne({_id:req.user.id});
  res.json(userData.cartData);
})

// api for all orders for admin panel
app.get('/allorders', async(req, res)=>{
  let alluser = await User.find({});
  res.json(alluser);
})

app.listen(port, (error) => {
  if (!error) {
    console.log("Server Running on port " + port);
  } else {
    console.log("Error " + error);
  }
});
