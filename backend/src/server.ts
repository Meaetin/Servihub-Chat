// ESM
import Fastify from 'fastify'
import { PrismaClient } from '@prisma/client'

const fastify = Fastify({
  logger: true
})

const prisma = new PrismaClient()

// Declare a route to get all users
fastify.get('/', async function (request, reply) {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    })
    reply.send({ users })
  } catch (error) {
    fastify.log.error(error)
    reply.status(500).send({ error: 'Failed to fetch users' })
  }
})

// Close Prisma connection on shutdown
fastify.addHook('onClose', async () => {
  await prisma.$disconnect()
})

// Run the server
fastify.listen({ 
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
  host: '0.0.0.0'
}, function (err, address) {
  if (err) {
    fastify.log.error(err)
    process.exit(1)
  }
})