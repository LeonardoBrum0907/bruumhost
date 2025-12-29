import axios from 'axios'
import dotenv from 'dotenv'

dotenv.config()

const HOSTINGER_DNS_API_KEY = process.env.HOSTINGER_DNS_API_KEY!
const DOMAIN = process.env.DOMAIN || 'leobrum.run'
const HOSTINGER_API_BASE_URL = process.env.HOSTINGER_API_BASE_URL!

const apiClient = axios.create({
   baseURL: HOSTINGER_API_BASE_URL,
   headers: {
      'Authorization': `Bearer ${HOSTINGER_DNS_API_KEY}`,
      'Content-Type': 'application/json'
   }
})

interface DNSZoneRecord {
   name: string
   type: 'A' | 'AAAA' | 'CNAME' | 'ALIAS' | 'MX' | 'TXT' | 'NS' | 'SOA' | 'SRV' | 'CAA'
   records: Array<{ content: string; is_disabled?: boolean }>
   ttl: number
}

export async function createDNSRecord(subdomain: string, ip: string, ttl: number = 3600): Promise<void> {
   const currentRecords = await getDNSRecords()

   const existingRecord = currentRecords.find(
      (record: DNSZoneRecord) => record.name === subdomain && record.type === 'A'
   )

   if (existingRecord) {
      const updatedRecords = currentRecords.map((record: DNSZoneRecord) => {
         if (record.name === subdomain && record.type === 'A') {
            return {
               name: subdomain,
               type: 'A' as const,
               records: [{ content: ip }],
               ttl
            }
         }

         return record
      })

      await apiClient.put(`/api/dns/v1/zones${DOMAIN}`, {
         overwrite: true,
         zone: updatedRecords
      })
   } else {
      const newRecord: DNSZoneRecord = {
         name: subdomain,
         type: 'A' as const,
         records: [{ content: ip }],
         ttl
      }

      const zone = [...currentRecords, newRecord]

      await apiClient.put(`/api/dns/v1/zones${DOMAIN}`, {
         overwrite: false,
         zone
      })
   }
}

export async function getDNSRecords(): Promise<DNSZoneRecord[]> {
   try {
      const response = await apiClient.get(`/api/dns/v1/zones/${DOMAIN}`)

      return response.data || []
   } catch (error: any) {
      console.error('Erro ao buscar registros DNS:', error.response?.data || error.message)
      throw error
   }
}

export async function deleteDNSRecord(subdomain: string): Promise<void> {
   await apiClient.delete(`/api/dns/v1/zones/${DOMAIN}`, {
      data: {
         filters: [
            {
               name: subdomain,
               type: 'A'
            }
         ]
      }
   })
}