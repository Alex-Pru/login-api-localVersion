const express = require("express")
const bodyParser = require("body-parser")
const mongoose = require("mongoose")
const jwt = require("jsonwebtoken")
const bcrypt = require("bcrypt")
const fs = require("fs")
const jwtMiddleware = require('express-jwt')



const app = express()
const PORT = 3000

app.use(bodyParser.json())

const privateKey= fs.readFileSync('private.pem', 'utf-8')
const publicKey = fs.readFileSync('public.pem', 'utf-8')

app.use(jwtMiddleware({secret: privateKey, algorithms: ['HS256']}))

const userSchema = new mongoose.Schema({
    nome: String,
    email: String,
    senha: String,
    telefones: [
    {
      numero: String,
      ddd: String
    }
  ],
  ultimo_login: {
    type: Date,
    default: null
  }
});

mongoose.connect('mongodb://localhost:27017/api_users', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'Erro de conexão ao MongoDB: '));
db.once('open', () => {
    console.log("Conectado ao MongoDB!")
})
db.on('error', (err) => console.error('Erro de conexão ao MongoDB: ', err))

const User = mongoose.model('User', userSchema)

app.post('/register', async (req, res) => {

    try{
        const {nome, email, senha, telefones} = req.body


        const hashedsenha = await bcrypt.hash(senha, 10)

        const newUser = new User({
            nome,
            email,
            senha: hashedsenha,
            telefones,
            ultimo_login : new Date()
        })

        await newUser.save()

        const token = jwt.sign({username: newUser.nome }, privateKey, {expiresIn: '30m' })

        const response = {
            id: newUser._id, 
            data_criacao: newUser.createdAt,
            data_atualizacao: newUser.updatedAt,
            ultimo_login: newUser.ultimo_login,
            token
          }

        res.status(201).json(response)
    } catch (error){
        console.error(error)

        res.status(422).json({message: 'E-mail já existente!'})
    }
    
})

app.listen(PORT, () => {
    console.log(`O servidor está rodando na porta ${PORT}`)
})


app.post('/login', async (req, res) => {
    try{
    const { email, senha} = req.body
    const user = await User.findOne({ email })

    if(!user || !(await bcrypt.compare(senha, user.senha))) {
        return res.status(401).json({message: 'Usuário e/ou senha inválidos!'})
    }

    user.ultimo_login = new Date()
    await user.save()

    const token = jwt.sign({email: user.email}, publicKey, {expiresIn: '30m'})

    const response = {
        id: user._id,
        data_criacao: user.createdAt,
        data_atualizacao: user.updatedAt,
        ultimo_login: user.ultimo_login,
        token
    }

    res.json(response)
}
    catch (error){
        console.error(error)
        res.status(500).json({ message: 'Erro Interno de Servidor'})
    }
})


app.get('/api/protegida', (req, res) => {
    const user = req.user

    res.json({message: 'Rota Protegida!', user})
})

app.use((err, req, res, next) => {
    if(err.name === 'UnauthorizedError'){
        res.status(401).json({message: 'Não autorizado'})
    } else if(err.name === 'TokenExpiredError'){
        res.status(401).json({message: 'Sessão inválida'})
    }
    else{
        next(err)
    }

})