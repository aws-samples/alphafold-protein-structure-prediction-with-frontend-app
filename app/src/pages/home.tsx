import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/layout'
import { Link, Breadcrumbs, Box } from '@mui/material'
import { useTranslation } from 'react-i18next'
import '../lib/i18n'

export const Home = () => {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation('ns1')

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
      changeLanguage={i18n.changeLanguage}
    >
      <>{t('No Content')}</>
    </Layout>
  )
}
