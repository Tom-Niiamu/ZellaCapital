import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL = 'https://xpelkzilrfklrntdylme.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwZWxremlscmZrbHJudGR5bG1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4OTQ4NjMsImV4cCI6MjEwMjQ3MDg2M30.iMJUWEXC2c4Bj4dTiMcDdOfD2AHYae1thvecXk18QVA'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)