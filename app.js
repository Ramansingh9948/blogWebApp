const express = require("express");
const path = require("path");
const ejsMate = require("ejs-mate");
const bodyParser = require('body-parser');
const mongoose = require("mongoose");
const passport = require('passport');
const methodOverride = require("method-override");

const session = require('express-session');
const flash = require('connect-flash'); // Add this line
const { body, validationResult } = require('express-validator');
const User = require("./Models/user");


// Import models
// const User = require("./Models/user.js");
const Article = require("./Models/article.js");
const Quote = require("./Models/quote.js"); // Import the Quote model
const ContactUs = require("./Models/contactUs.js");
const contactUs = require("./Models/contactUs.js");


// Initialize the app
const app = express();

// Setup view engine
app.engine('ejs', ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views/webPages"));
app.use(bodyParser.json()); 
app.use(methodOverride("_method"));


// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "/public/assets")));

// Database connection
const dbURI = 'mongodb://localhost:27017/TextTroveDB';
mongoose.connect('mongodb://localhost:27017/TextTroveDB')
  .then(() => console.log('Connected to MongoDB successfully'))
  .catch(err => console.error('Failed to connect to MongoDB:', err));

// Express session
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: false,
}));

// Connect-flash setup
app.use(flash());

// Passport setup
app.use(passport.initialize());
app.use(passport.session());
require('./config/passport')(passport);

// = async(req, res, next) =>{
//     let { id } = req.params;
//     let article = await Article.findById(id);
//     if (!article || !article.owner._id.equals(res.locals.currentUser._id)) {
//         req.flash("error", "You do not have permission to edit this article");
//         return res.status(403).redirect(`/articles/${id}`);
//     }
//     next();
// };
// = async(req, res, next) =>{
//     let { id } = req.params;
//     let quote = await Quote.findById(id);
//     if (!quote || !quote.author._id.equals(res.locals.currentUser._id)) {
//         req.flash("error", "You do not have permission to edit this quote");
//         return res.status(403).redirect(`/quotes/${id}`);
//     }
//     next();
// };
// Middleware to save the original URL
// Middleware to make `isAuthenticated` available in all templates
app.use((req, res, next) => {
    res.locals.isAuthenticated = req.session.isAuthenticated || false;
    res.locals.user = req.session.user || null; // optional: if you want user info in views
    next();
  });
  

// Middleware to make flash messages available in all views
app.use((req, res, next) => {
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    next();
});

// Routes
app.get("/", (req, res) => res.render("home.ejs"));
app.get("/signup", (req, res) => res.render("signup.ejs"));
app.get("/login", (req, res) => res.render("login.ejs"));

// Register route
app.post('/signup', [
    body('username').not().isEmpty().withMessage('Username is required'),
    body('email').isEmail().withMessage('Email is invalid'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password } = req.body;
    try {
        let user = await User.findOne({ email });
        if (user) {
            req.flash('error', 'Email already exists');
            return res.redirect('/signup');
        }

        // Register user using passport-local-mongoose
        user = new User({ username, email });
        await User.register(user, password);
        req.flash('success', 'User registered successfully');
        res.redirect('/login');
    } catch (err) {
        console.error(err.message);
        req.flash('error', 'Something went wrong');
        res.redirect('/signup');
    }
});

// Login route
// Login route example
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
  
    // Authenticate the user (e.g., check the password, etc.)
    const user = await User.findOne({ email });
    if (user && (await passport.authenticate(user.password, password))) {
      // Set session variable or token
      req.session.isAuthenticated = true;
      req.session.user = user;
  
      // Redirect to homepage or another page
      res.redirect('/');
    } else {
      res.status(401).send('Invalid credentials');
    }
  });
  
  // Logout route to end the session
  app.get('/logout', (req, res) => {
    req.session.destroy(() => {
      res.redirect('/');
    });
  });
  


// Middleware to ensure the user is authenticated
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
}
// Example routes
app.get('/terms', (req, res) => res.render('terms.ejs'));
app.get('/privacy', (req, res) => res.render('privacy.ejs'));
app.get('/cookies', (req, res) => res.render('cookies.ejs'));
app.get('/contact', (req, res) => res.render('contact.ejs'));

app.post('/contact', async (req, res) => {
    try {
      const { name, email, message } = req.body;
      const contactingDetail = new ContactUs({ name, email, message }); // Use parentheses with curly braces
      await contactingDetail.save();
  
      // Send email using a service like SendGrid or Nodemailer
      // For simplicity, we'll just log the contact details
      console.log(contactingDetail);
  
      res.send('Thank you for contacting us! We will get back to you soon.');
    } catch (error) {
      console.error('Error saving contact details:', error);
      res.status(500).send('An error occurred. Please try again later.');
    }
  });
  
// Static pages
app.get('/about', (req, res) => res.render('about'));
app.get('/quotes', async (req, res) => {
    try {
        const quotes = await Quote.find().sort({ createdAt: -1 }); // Fetch quotes
        res.render('quotes', { quotes });
    } catch (error) {
        console.error('Error fetching quotes:', error);
        res.status(500).send('Server error');
    }
});

// Quote submission form route
app.get('/submit-quote', ensureAuthenticated, (req, res) => {
    res.render('quoteForm'); // Render quote submission form
});

// Quote submission handling
app.post('/submit-quote', ensureAuthenticated, async (req, res) => {
    const { quote, author } = req.body;
    if (!quote || quote.trim() === '') {
        return res.status(400).send('Quote cannot be empty.');
    }

    try {
        const newQuote = new Quote({ quote, author: author || 'Anonymous' });
        await newQuote.save();
        res.redirect('/quotes'); // Redirect to quotes page after submission
    } catch (error) {
        console.error('Error saving quote:', error);
        res.status(500).send('Server error');
    }
});
//Quote Show Route
app.get("/quotes/:id", async(req, res) =>{
    const id = req.params.id;
    const quote = await Quote.findById(id);
    if (!quote) {
        // Handle the case where the article does not exist
        res.status(404).send('Quote not found.');
    }
    try {
        console.log(quote);
        // If the article is found, render the article view
        res.render("quoteDetails", { quote });
    } catch (err) {
        console.error('Error fetching quote:', err);
        res.status(500).send('Server error');
    }

})
//Quote 
app.get("/quotes/:id/edit", async(req, res) => {
    const id = req.params.id;
    const quote = await Quote.findById(id);
    if (!quote) {
        res.status(500).send('not found');
        }
        try {
            res.render("editQuote", { quote });
            } catch (err) {
                console.log("error", err);
                res.status(500).send('Server error');
            }

    });
    app.put("/quotes/:id", async (req, res) => {
        const { quote_text } = req.body; // Destructure quote_text from the request body
        const id = req.params.id;
    
        // Check if quote_text is a string and not empty
        if (!quote_text || typeof quote_text !== "string") {
            return res.status(400).send("Quote content must be a non-empty string");
        }
    
        try {
            // Use the quote_text directly in the update
            const updatedQuote = await Quote.findByIdAndUpdate(
                id,
                { quote: quote_text }, // Update the quote field with the correct string
                { new: true }
            );
    
            if (!updatedQuote) {
                return res.status(404).send("Quote not found");
            }
    
            res.redirect(`/quotes/${id}`);
        } catch (err) {
            console.error("Error updating quote:", err);
            res.status(500).send("Server error");
        }
    });
//Quote Delete

// Articles routes
app.get('/articles', async (req, res) => {
    try {
        const articles = await Article.find().sort({ createdAt: -1 });
        res.render('articles', { articles });
    } catch (error) {
        console.error('Error fetching articles:', error);
        res.status(500).send('Server error');
    }
});
// Article viewing
app.get("/articles/:id", async (req, res) => {
    const id = req.params.id;
    const article = await Article.findById(id);
    if (!article) {
        // Handle the case where the article does not exist
        res.status(404).send('Article not found.');
    }
    try {
        console.log(article);
        // If the article is found, render the article view
        res.render("articleDetails", { article });
    } catch (err) {
        console.error('Error fetching article:', err);
        res.status(500).send('Server error');
    }

});
//
//Update Articles
app.get("/articles/:id/edit", async (req, res) => {
    const id = req.params.id;

    try {
        const article = await Article.findById(id);
        if (!article) {
            return res.status(404).send("Article not found");
        }
        res.render("editArticle", { article });
    } catch (err) {
        console.error("Error retrieving article:", err);
        res.status(500).send("Server error");
    }
});

app.put("/articles/:id", async (req, res) => {
    const { content } = req.body;
    const id = req.params.id;

    // Validation for content
    if (!content || typeof content !== "string" || content.trim() === "") {
        return res.status(400).send("Article content must be a non-empty string");
    }

    try {
        // Corrected field name to match the schema
        const updatedArticle = await Article.findByIdAndUpdate(
            id,
            { content: content }, // Use 'content' instead of 'article'
            { new: true }
        );

        if (!updatedArticle) {
            return res.status(404).send("Article not found");
        }

        // Redirect to the updated article
        res.redirect(`/articles/${id}`);
    } catch (err) {
        console.error("Error updating article:", err);
        res.status(500).send("Server error");
    }
});


// Protected routes
app.get('/write-article', ensureAuthenticated, (req, res) => res.render('writeArticle'));

app.post('/submit-article', ensureAuthenticated, async (req, res) => {
    const { title, author, content } = req.body;
    try {
        const newArticle = new Article({ title, author, content });
        await newArticle.save();
        res.redirect('/articles');
    } catch (error) {
        console.error('Error saving article:', error);
        res.status(500).send('Server error');
    }
});

app.get('/*', (req, res) => {
    res.render('error.ejs');
});

// Start the server
const port = 3001;
app.listen(port, () => {
    console.log(`This server is listening on port ${port}`);
});
