import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

export const resources = {
  en: {
    ns1: {
      Home: 'Home',
      'No Content': 'No content to show on this page.',
      'Job Create View Title': 'Create Protein Structure Prediction Job',
      'Job List View Title': 'Protein Structure Prediction Jobs',
      'Job Result View Title': 'Protein Structure Prediction Job Result',
      'Create Job Button Title': 'Create Job',
      'Terminate Job Button Title': 'Terminate Job',
      'Download PDB': 'Download PDB',
      'Job ID': 'Job ID',
      'Job Start Time': 'Job Start Time',
      'Job End Time': 'Job End Time',
      'Job Status': 'Job Status',
      'Not Found PDB': 'PDB Not Found. For Colabfold, select CPU job.',
      'Job Result View Help Message': 'To show the prediction result, click on a job with COMPLETED status.',
      'Fasta Data Help Message': 'FASTA format data',
      'Create Job Help Message': 'Create a protein structure prediction job. takes 10s to complete job creation'
    }
  },
  ja: {
    ns1: {
      Home: 'ホーム',
      'No Content': 'この画面に表示するコンテンツはありません。',
      'Job Create View Title': 'タンパク質構造予測ジョブの作成',
      'Job List View Title': 'タンパク質構造予測ジョブの一覧',
      'Job Result View Title': 'タンパク質構造予測ジョブの結果',
      'Create Job Button Title': '構造予測ジョブの作成',
      'Terminate Job Button Title': 'ジョブの強制終了',
      'Download PDB': 'PDB ファイルのダウンロード',
      'Job ID': 'ジョブ ID',
      'Job Start Time': '開始日時',
      'Job End Time': '終了日時',
      'Job Status': 'ステータス',
      'Not Found PDB': 'PDB ファイルが見つかりませんでした。Colabfold の場合は CPU ジョブを選択してください。',
      'Job Result View Help Message': 'ステータスが COMPLETED のジョブをクリックすると解析結果を表示します。',
      'Fasta Data Help Message': 'FASTA 形式のテキストデータ',
      'Create Job Help Message': '構造予測ジョブを作成します（ジョブの投入完了まで数十秒かかります）'
    }
  }
} as const

i18n.use(initReactI18next).init({
  lng: 'en',
  ns: ['ns1'],
  defaultNS: 'ns1',
  resources
})

export default i18n
