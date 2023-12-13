const express = require('express')
const bodyParser = require('body-parser')
const mongoose = require('mongoose')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
const fs = require('fs')
const { expressjwt } = require('express-jwt')

const errorMessages = {
  EMAIL_ALREADY_EXISTS: 'E-mail já existente!',
  INVALID_CREDENTIALS: 'Usuário e/ou senha inválidos!',
  INTERNAL_SERVER_ERROR: 'Erro interno de servidor',
  UNAUTHORIZED: 'Não autorizado',
  SESSION_EXPIRED: 'Sessão expirada'
}

const app = express()
const PORT = 3000

app.use(bodyParser.json())

app.listen(PORT, () => {
  console.log(`O servidor está rodando na porta ${PORT}`)
})

const privateKey = fs.readFileSync('private.pem', 'utf-8')
const publicKey = fs.readFileSync('public.pem', 'utf-8')

app.use('/api', (req, res, next) => {
  expressjwt({ secret: publicKey, algorithms: ['RS256'] })(req, res, next)
})

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
  },
  data_criacao: {
    type: Date,
    default: null
  },
  data_atualizacao: {
    type: Date,
    default: null
  }
})

const url = 'mongodb://0.0.0.0:27017/api_users'

mongoose.connect(url)

const db = mongoose.connection
db.on('error', console.error.bind(console, 'Erro de conexão ao MongoDB: '))
db.once('open', () => {
  console.log('Conectado ao MongoDB!')
})
db.on('error', (err) => console.error('Erro de conexão ao MongoDB: ', err))

const User = mongoose.model('User', userSchema)

app.post('/register', async (req, res) => {
  try {
    const { nome, email, senha, telefones } = req.body

    const hashedsenha = await bcrypt.hash(senha, 10)

    const newUser = new User({
      nome,
      email,
      senha: hashedsenha,
      telefones,
      data_criacao: new Date()
    })

    await newUser.save()

    const token = jwt.sign({ email: newUser.email }, privateKey, { algorithm: 'RS256', expiresIn: 1800 })

    const response = {
      id: newUser._id,
      data_criacao: newUser.data_criacao,
      data_atualizacao: newUser.data_atualizacao,
      ultimo_login: newUser.ultimo_login,
      token
    }

    res.status(201).json(response)
  } catch (error) {
    console.error(error)

    res.status(422).json({ message: errorMessages.EMAIL_ALREADY_EXISTS })
  }
})

app.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body
    const user = await User.findOne({ email })

    if (!user || !(await bcrypt.compare(senha, user.senha))) {
      return res.status(401).json({ message: errorMessages.INVALID_CREDENTIALS })
    }

    user.ultimo_login = new Date()
    await user.save()

    const token = jwt.sign({ id: user._id, email: user.email, nome: user.nome }, privateKey, { algorithm: 'RS256', expiresIn: 1800 })

    const response = {
      id: user._id,
      data_criacao: user.data_criacao,
      data_atualizacao: user.data_atualizacao,
      ultimo_login: user.ultimo_login,
      token
    }

    res.json(response)
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: errorMessages.INTERNAL_SERVER_ERROR })
  }
})

app.get('/api/protegida', (req, res) => {
  const user = req.auth

  res.json({ message: 'Rota Protegida! ', user })
})

app.use((err, req, res, next) => {
  if (err.name === 'UnauthorizedError') {
    res.status(401).json({ message: errorMessages.UNAUTHORIZED })
  } else if (err.name === 'TokenExpiredError') {
    res.status(401).json({ message: errorMessages.SESSION_EXPIRED })
  } else {
    next(err)
  }
})
