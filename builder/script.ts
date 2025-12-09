import { exec, ChildProcess } from 'child_process'
import path from 'path'
import fs from 'fs'
import mime from 'mime-types'
import Redis from 'ioredis'
import dotenv from 'dotenv'

dotenv.config()

const REDIS_URL = process.env.REDIS_URL!
const PROJECT_ID = process.env.PROJECT_ID!
const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT!
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY!
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY!
const MINIO_BUCKET = process.env.MINIO_BUCKET!

const publisher = new Redis(REDIS_URL)