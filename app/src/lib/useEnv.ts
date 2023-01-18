import useSWR from 'swr'

const dev = import.meta.env.MODE === 'development'

export interface Env {
  apiEndpoint: string
}

const fetcher = async () => {
  const res = await fetch('/env.json')
  return res.json()
}

export function useEnv() {
  const { data: env } = useSWR<Env>(dev ? null : '/env.json', fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  })

  if (dev) {
    return {
      env: Object.freeze({
        apiEndpoint: import.meta.env.VITE_API_ENDPOINT
      }) as Env
    }
  }

  return { env: Object.freeze(env) }
}
