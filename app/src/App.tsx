import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ConfirmProvider } from 'material-ui-confirm'
import { useEnv } from './lib/useEnv'
import { Home } from './pages/home'
import { JobManager } from './pages/job_manager'

function App() {
  const { env } = useEnv()
  if (!env) return <>Loading...</>

  return (
    <ConfirmProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/alphafold2" element={<JobManager type={'alphafold2'} />} />
          <Route path="/colabfold" element={<JobManager type={'colabfold'} />} />
        </Routes>
      </BrowserRouter>
    </ConfirmProvider>
  )
}

export default App
