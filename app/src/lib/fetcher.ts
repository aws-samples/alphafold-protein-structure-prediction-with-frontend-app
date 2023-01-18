export interface Job {
  id: string
  start: number | string
  end: number | string
  status: string
  pdb_url?: string
}

export const getJobs = async (url: string) => {
  const res = await fetch(url)
  const payload = await res.json()
  return payload.data as Job[]
}

export const getJob = async (url: string) => {
  const res = await fetch(url)
  return (await res.json()) as Job
}

export const terminateJob = async (url: string) => {
  const res = await fetch(url, { method: 'DELETE' })
  return await res.json()
}

export const createJob = async (url: string, fasta: string) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fasta: fasta })
  })
  return await res.json()
}
