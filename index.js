const express = require('express')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
var cors = require('cors')
var jwt = require('jsonwebtoken');
require('dotenv').config()
const app = express()
const port = process.env.PORT || 5000;

const  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);


//middleWare 
app.use(express.json())
app.use(cors(
  {
    origin: [
      "http://localhost:5173",
      "bistro-boss-7fe4b.web.app",
      "bistro-boss-7fe4b.firebaseapp.com",
    ],
    credentials: true,
  }
))



//mongodb connection 


const uri = `mongodb+srv://${process.env.USER_DB}:${process.env.USER_PASS}@cluster0.aq01puw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

console.log(uri);

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const userCollection = client.db("bistroDB").collection('users');
    const menuCollection = client.db("bistroDB").collection('menu');
    const reviewCollection = client.db("bistroDB").collection('reviews');
    const cartCollection = client.db("bistroDB").collection('carts');


    //create a token jwt relate api
    app.post('/jwt', async(req,res) => {
        const user = req.body;
        const token = jwt.sign({user}, process.env.ACCESS_TOKEN_SECRET,{expiresIn: '1h'});

        res.send({token});
    })

    //token vaildation or middleware
    const varifyToken = (req,res,next)=>{
      console.log('inside verify token',req.headers.authorization);
     
      if(!req.headers.authorization){
        return res.status(401).send({massage : 'forbidden access'});
      }

      const token = req.headers.authorization.split(' ')[1];
      // verify a token
      jwt.verify(token,process.env.ACCESS_TOKEN_SECRET, function(err,decoded){

        if(err){
          return res.status(401).send({massage : 'forbidden access'})
        }

         req.decoded = decoded;
        next();
      })

      
    }

    //admin verify middle  token  | where we use many api
    const verifyAdmin = async(req,res,next)=>{
     
      const email = req.decoded.user.email;
      const query = {email : email};
      const user = await userCollection.findOne(query);
     

      const isAdmin = user?.role === 'admin';
      

      if(! isAdmin){
        res.status(403).send({massage : 'fordiden'});
      }

      next();

    }




    //user relate api 
    //users post api
    //get user data from dashboard alluser 
    app.get('/users', varifyToken, verifyAdmin, async(req,res) => {
       
        const result = await userCollection.find().toArray();
        res.send(result);
        
    })

    //delete api from dashboard alluser
    app.delete('/users/:id', varifyToken, verifyAdmin, async(req,res) =>{
        const id = req.params.id;
        const query = {_id : new ObjectId(id)};
        const result = await userCollection.deleteOne(query);
        res.send(result);
    })
     
    // make admin dashboard patch
    app.patch('/users/admin/:id', varifyToken, verifyAdmin, async(req,res) =>{
        const id = req.params.id;
        const filter = {_id : new ObjectId(id)};

        const updateDoc = {
            $set: {
             role : 'admin',
            },
          };

          const result = await userCollection.updateOne(filter,updateDoc);
          res.send(result);
    })




    //get api for find admin for apply for navigation 
    app.get('/users/admin/:email', varifyToken, async (req, res) => {
      const email = req.params.email;

      // console.log(req.decoded);

      // console.log(email);
  
      if (email !== req.decoded.user.email) {
        
          return res.status(403).send({ message: 'unauthorized' });
      }
  
      const query = { email: email };
      const user = await userCollection.findOne(query);
  
      let admin = false;
      if (user) {
          admin = user.role === 'admin';
      }
  
      res.send({ admin });
  });
  

    //post api for dashboard
    app.post('/users', async(req,res) => {
        const user = req.body;

        //cheack user email duplicated
        const query = {email : user.email};
        const extestingUser = await userCollection.findOne(query);
        
        if(extestingUser){
            return res.send({massage : 'already sing In' , insertedId : null});
        }

        const result = await userCollection.insertOne(user);
        res.send(result)
    })



    //get menu api
    
    app.get('/menu', async(req, res) =>{

        const user = menuCollection.find();
        const result = await user.toArray();
        res.send(result);
    })

    // post from dashboard addItem form
    app.post('/menu', varifyToken,verifyAdmin, async(req,res) => {
      const menu = req.body;
      const result = await menuCollection.insertOne(menu);
      res.send(result);
    })

    // delete from dashboard MangeItem section
    app.delete('/menu/:id', varifyToken,verifyAdmin, async(req,res) =>{
      const id = req.params.id;
      const query = {_id : new ObjectId(id)};
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    })

    //get review api
    app.get('/review', async(req, res) =>{

        const user = reviewCollection.find();
        const result = await user.toArray();
        res.send(result);
    })

    
    
    //Cart collection section
    //get cart data and show navbar
    app.get('/carts',async(req, res) =>{
        const email = req.query.email;
        const options = {email : email};
        const query = cartCollection.find(options);
        const result = await query.toArray();
        res.send(result);
    })


    //post data from foodCart
    app.post('/carts', async(req,res)=>{
        const user = req.body;
        const result = await cartCollection.insertOne(user);
        res.send(result);
    })

    //delete from dashboard > cart 
    app.delete('/carts/:id', async(req,res) =>{
        const id = req.params.id;
        const query = {_id : new ObjectId(id)};
        const result = await cartCollection.deleteOne(query);
        res.send(result)
    
    })


    //Payment intent
    app.post('/create-payment-intent', async(req,res) =>{
      const {price} = req.body;

      const amount = parseInt(price * 100);
      console.log(amount);
      const paymentIntent = await stripe.paymentIntents.create({
        amount : amount,
        currency : 'usd',
        payment_method_types : ["card"],

      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });





    })


    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



//test get api
app.get('/', (req, res) => {
  res.send('Bisto-Boss-connected')
})

app.get('/user', (req,res) =>{
    res.send('Bisto-Boss-runnig');
})


app.listen(port, () => {
  console.log(`Bisto-Boss-runnig on port ${port}`)
})