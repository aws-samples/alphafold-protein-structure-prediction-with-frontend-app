import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import useSWR from 'swr'
import { useEnv } from '../lib/useEnv'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  Paper,
  Link,
  Breadcrumbs,
  TableRow,
  Button,
  Typography,
  Tooltip,
  Backdrop,
  TextField,
  Box,
  CircularProgress,
  Grid
} from '@mui/material'
import { Help as HelpIcon } from '@mui/icons-material/'
import { Layout, baseColor } from '../components/layout'
import { getJobs, getJob, Job, terminateJob, createJob } from '../lib/fetcher'

// @ts-ignore
import * as $3Dmol from '3dmol/build/3Dmol-nojquery.js'

const defaultFasta = `>sp|Q5VSL9|STRP1_HUMAN Striatin-interacting protein 1 OS=Homo sapiens OX=9606 GN=STRIP1 PE=1 SV=1
MEPAVGGPGPLIVNNKQPQPPPPPPPAAAQPPPGAPRAAAGLLPGGKAREFNRNQRKDSE
GYSESPDLEFEYADTDKWAAELSELYSYTEGPEFLMNRKCFEEDFRIHVTDKKWTELDTN
QHRTHAMRLLDGLEVTAREKRLKVARAILYVAQGTFGECSSEAEVQSWMRYNIFLLLEVG
TFNALVELLNMEIDNSAACSSAVRKPAISLADSTDLRVLLNIMYLIVETVHQECEGDKAE
WRTMRQTFRAELGSPLYNNEPFAIMLFGMVTKFCSGHAPHFPMKKVLLLLWKTVLCTLGG
FEELQSMKAEKRSILGLPPLPEDSIKVIRNMRAASPPASASDLIEQQQKRGRREHKALIK
QDNLDAFNERDPYKADDSREEEEENDDDNSLEGETFPLERDEVMPPPLQHPQTDRLTCPK
GLPWAPKVREKDIEMFLESSRSKFIGYTLGSDTNTVVGLPRPIHESIKTLKQHKYTSIAE
VQAQMEEEYLRSPLSGGEEEVEQVPAETLYQGLLPSLPQYMIALLKILLAAAPTSKAKTD
SINILADVLPEEMPTTVLQSMKLGVDVNRHKEVIVKAISAVLLLLLKHFKLNHVYQFEYM
AQHLVFANCIPLILKFFNQNIMSYITAKNSISVLDYPHCVVHELPELTAESLEAGDSNQF
CWRNLFSCINLLRILNKLTKWKHSRTMMLVVFKSAPILKRALKVKQAMMQLYVLKLLKVQ
TKYLGRQWRKSNMKTMSAIYQKVRHRLNDDWAYGNDLDARPWDFQAEECALRANIERFNA
RRYDRAHSNPDFLPVDNCLQSVLGQRVDLPEDFQMNYDLWLEREVFSKPISWEELLQ`

export function JobManager({ type }: { type: string }) {
  const [jobResult, setJobResult] = useState<Job>()
  const [loading, setLoading] = useState(false)
  const [fasta, setFasta] = useState(defaultFasta)
  const pdbViewer = useRef(null)
  const navigate = useNavigate()
  const { env } = useEnv()
  const { data: jobs, mutate } = useSWR(`${env?.apiEndpoint}/${type}/jobs`, getJobs, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  })

  useEffect(() => {
    const render = async () => {
      const viewer = $3Dmol.createViewer(pdbViewer.current)
      await $3Dmol.download(`url:${jobResult?.pdb_url}`, viewer, {})
      viewer.setStyle({ cartoon: { color: 'spectrum' } })
      viewer.render()
    }
    if (jobResult?.pdb_url) render()
  }, [jobResult])

  if (!env) return <>loading...</>

  const getJobResult = async (id: string) => {
    try {
      setLoading(true)
      const job = await getJob(`${env.apiEndpoint}/${type}/jobs/${id}`)
      setJobResult(job)
    } finally {
      setLoading(false)
    }
  }

  const postTerminateJob = async (id: string) => {
    try {
      setLoading(true)
      await terminateJob(`${env.apiEndpoint}/${type}/jobs/${id}`)
    } finally {
      setLoading(false)
    }
  }

  const postCreateJob = async () => {
    try {
      setLoading(true)
      await createJob(`${env.apiEndpoint}/${type}/jobs`, fasta)
      await new Promise((resolve) => setTimeout(resolve, 5000))
      await mutate()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout
      appBarRender={() => {
        return (
          <Box sx={{ ml: 2 }}>
            <Breadcrumbs sx={{ fontSize: '0.9em' }}>
              <Link underline="hover" color="inherit" onClick={() => navigate('/')} sx={{ cursor: 'pointer' }}>
                ホーム
              </Link>
              <Link underline="hover" color="text.primary" href="/items">
                {type.toUpperCase()}
              </Link>
            </Breadcrumbs>
          </Box>
        )
      }}
    >
      <Box sx={{ mb: 1 }}>
        <Typography variant="body1" sx={{ fontWeight: 600, color: baseColor() }}>
          タンパク質構造予測ジョブの作成
        </Typography>
      </Box>

      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Box>
          <TextField
            label="FASTA 形式のテキストデータ"
            spellCheck={false}
            multiline
            size="small"
            rows={15}
            inputProps={{ style: { fontSize: '0.5em', lineHeight: '1.5em' } }}
            value={fasta}
            onChange={(e) => setFasta(e.target.value)}
            sx={{ mt: 0.5, width: '100%' }}
          />
          <Grid container direction="row" justifyContent="flex-end" alignItems="center">
            <Tooltip title="構造予測ジョブを作成します（ジョブの投入完了まで数十秒かかります）">
              <Button
                variant="contained"
                size="small"
                onClick={() => postCreateJob()}
                sx={{
                  mt: 1,
                  boxShadow: 'none',
                  '&:hover': { boxShadow: 'none' }
                }}
              >
                構造予測ジョブの作成
              </Button>
            </Tooltip>
          </Grid>
        </Box>
      </Paper>

      <Box sx={{ mb: 1, mt: 3 }}>
        <Typography variant="body1" sx={{ fontWeight: 600, color: baseColor() }}>
          タンパク質構造予測ジョブの一覧
        </Typography>
      </Box>

      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Box sx={{ mb: 3 }}>
          <Table size="small" sx={{}}>
            <TableHead sx={{ '& .MuiTableCell-head': { fontWeight: 600 } }}>
              <TableRow>
                <TableCell>ジョブ ID</TableCell>
                <TableCell>開始日時</TableCell>
                <TableCell>終了日時</TableCell>
                <TableCell>ステータス</TableCell>
                <TableCell align="right"></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Array.isArray(jobs) &&
                jobs.map((job) => {
                  return (
                    <TableRow key={job.id}>
                      <TableCell>{job.id}</TableCell>
                      <TableCell>
                        {(typeof job.start === 'number' && format(new Date(job.start * 1000), 'yyyy/MM/dd HH:mm:ss')) ||
                          ''}
                      </TableCell>
                      <TableCell>
                        {(typeof job.end === 'number' && format(new Date(job.end * 1000), 'yyyy/MM/dd HH:mm:ss')) || ''}
                      </TableCell>
                      <TableCell>
                        {job.status === 'COMPLETED' ? (
                          <a href={'#' + job.id} onClick={() => getJobResult(job.id)}>
                            {job.status}
                          </a>
                        ) : (
                          <>{job.status}</>
                        )}
                      </TableCell>
                      <TableCell align="right" sx={{ pr: 0 }}>
                        {job.status === 'RUNNING' ? (
                          <Button
                            variant="outlined"
                            size="small"
                            color="error"
                            onClick={() => postTerminateJob(job.id)}
                            sx={{
                              boxShadow: 'none',
                              '&:hover': { boxShadow: 'none' }
                            }}
                          >
                            ジョブの強制終了
                          </Button>
                        ) : (
                          <></>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
            </TableBody>
          </Table>
          {Array.isArray(jobs) || (
            <Grid container justifyContent="center" alignItems="center" sx={{ width: '100%', mt: 3 }}>
              <CircularProgress />
            </Grid>
          )}
        </Box>
      </Paper>

      <Box sx={{ mb: 1, mt: 3 }}>
        <Typography variant="body1" sx={{ fontWeight: 600, color: baseColor() }}>
          タンパク質構造予測ジョブの結果
        </Typography>
      </Box>

      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Box sx={{ mb: 1, mt: 1 }}>
          <div style={{ fontWeight: 600 }}>
            {(jobResult && (
              <div>
                <Typography variant="body2" sx={{ ml: 1, color: baseColor() }}>
                  ジョブ ID: {jobResult.id}
                </Typography>
                {(jobResult.pdb_url && (
                  <div ref={pdbViewer} style={{ height: 500, width: 700, position: 'relative' }}></div>
                )) || (
                  <Grid container direction="row" justifyContent="flex-start" alignItems="center" sx={{ mt: 2, ml: 2 }}>
                    <HelpIcon fontSize="small" sx={{ color: baseColor(0.7) }}></HelpIcon>
                    <Typography variant="body2" sx={{ ml: 0.5 }}>
                      PDB ファイルが見つかりませんでした。Colabfold の場合は CPU ジョブを選択してください。
                    </Typography>
                  </Grid>
                )}
              </div>
            )) || (
              <Grid container direction="row" justifyContent="flex-start" alignItems="center">
                <HelpIcon fontSize="small" sx={{ color: baseColor(0.7) }}></HelpIcon>
                <Typography variant="body2" sx={{ ml: 0.5 }}>
                  ステータスが COMPLETED のジョブをクリックすると解析結果を表示します。
                </Typography>
              </Grid>
            )}
          </div>
        </Box>
      </Paper>
      <Backdrop sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }} open={loading}>
        <CircularProgress color="inherit" />
      </Backdrop>
    </Layout>
  )
}
