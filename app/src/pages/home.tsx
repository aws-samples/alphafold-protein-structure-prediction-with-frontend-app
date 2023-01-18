import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/layout'
import { Link, Breadcrumbs, Box } from '@mui/material'

export const Home = () => {
  const navigate = useNavigate()

  useEffect(() => {
    navigate('/alphafold2')
  }, [navigate])

  return (
    <Layout
      appBarRender={() => {
        return (
          <Box sx={{ ml: 2 }}>
            <Breadcrumbs sx={{ fontSize: '0.9em' }}>
              <Link underline="hover" color="inherit" onClick={() => navigate('/')} sx={{ cursor: 'pointer' }}>
                ホーム
              </Link>
            </Breadcrumbs>
          </Box>
        )
      }}
    >
      <>この画面に表示するコンテンツはありません。</>
    </Layout>
  )
}
