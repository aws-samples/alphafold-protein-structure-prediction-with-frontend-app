# AlphaFold2 Webapp on AWS

View this page in [English](README.md)

AlphaFold2 Webapp on AWS は、ユーザが GUI でAlphaFold2 や ColabFold を実行できるようなウェブアプリ環境を提供します。また、管理者は AlphaFold2 や ColabFold の解析環境を AWS CDK を用いて簡単に構築することができます。

<img src="doc/webui.png" width=500>

<img src="doc/architecture.png" width=500>

## 開発環境の前提条件

**NOTE**: 次のセクションに記載されている手順に従って開発環境をセットアップすることをおすすめします。

- [AWS CLI のインストール](https://docs.aws.amazon.com/ja_jp/cli/latest/userguide/install-cliv2.html) および [認証情報の設定](https://docs.aws.amazon.com/ja_jp/cli/latest/userguide/cli-configure-files.html)
- [Python 3](https://www.python.org/about/) のインストール
- [Node.js LTS](https://nodejs.org/en/) のインストール
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) のインストール

## AWS Cloud9 を使って開発環境を構築

**NOTE**: AWS Cloud9 環境は `us-east-1` (N. Virginia) リージョンに作成してください。
**NOTE**: この手順を使って開発環境を準備する場合は、上記の必要なソフトウェア (AWS CLI / Python / Node.js / Docker 等) は Cloud9 に初めからインストールされています。

1. [AWS CloudShell](https://docs.aws.amazon.com/cloudshell/latest/userguide/welcome.html) を起動して下記コマンドを実行

```sh
git clone https://github.com/aws-samples/cloud9-setup-for-prototyping
cd cloud9-setup-for-prototyping

## Cloud9 環境 "cloud9-for-prototyping" を構築します
./bin/bootstrap
```

1. AWS Cloud9 に移動して `cloud9-for-prototyping` を起動
1. `File` から `Upload Local Files` を押下
1. 本リポジトリのソース zip ファイルを `Drag & drop file here` に投下
1. `unzip` コマンドで zip を解凍してディレクトリを移動

```sh
Admin:~/environment $ unzip your_samples.zip
Admin:~/environment $ cd your_samples/
```

## デプロイ手順

**NOTE**: 以降の手順では `us-east-1` (N. Virginia) リージョンを使用します。
**NOTE:** 以降の手順は、上記 Cloud9 環境からの作業を推奨します

### 1. バックエンドの構築
- バックエンドのデプロイ前にフロントエンドをビルドします
```sh
## フロントエンドのビルド
cd app
npm install
npm run build
```

- `provisioning/bin/provisioning.ts` にある `c9Eip` の値を Cloud9 のパブリップ IP アドレス に修正

```diff
-  c9Eip: 'your-cloud9-ip'
+  c9Eip: 'xx.xx.xx.xx'
```

- 修正後、バックエンドをビルドします
```sh
cd ../provisioning
npm install
npx cdk bootstrap
## Network, Database, Storage などの構築
npx cdk deploy Alphafold2ServiceStack --require-approval never
cd ../
```

- 上記 CDK の Outputs から Alphafold2ServiceStack.GetSSHKeyCommand の値 `aws ssm get-parameter...` をコピー＆実行して秘密鍵を保存

```sh
aws ssm get-parameter --name /ec2/keypair/key-{任意のID} --region us-east-1 --with-decryption --query Parameter.Value --output text > ~/.ssh/keypair-alphafold2.pem

## 権限の変更
chmod 600 ~/.ssh/keypair-alphafold2.pem
```

### 2. ParallelCluster クラスターの作成

- バックエンドをデプロイしたら、次に ParallelCluster クラスターを作成します
- Cloud9 IDE のターミナルで以下の手順に従ってコマンドを実行します
- config.yml を修正することで、ワークロードに適したインスタンスタイプに変更することができます

```sh
## ParallelCluster コマンドのインストール
pip3 install aws-parallelcluster==3.3.0 --user

## リージョンの設定
export AWS_DEFAULT_REGION=us-east-1

## ParallelCluster を構築するための config.yml を作成
### colabfold の場合
npx ts-node provisioning/hpc/colabfold/config/generate-template.ts
### alphafold2 の場合
npx ts-node provisioning/hpc/alphafold2/config/generate-template.ts

## ParallelCluster クラスターの作成
### colabfold の場合
pcluster create-cluster --cluster-name hpccluster --cluster-configuration provisioning/hpc/colabfold/config/config.yml
### alphafold2 の場合
pcluster create-cluster --cluster-name hpccluster --cluster-configuration provisioning/hpc/alphafold2/config/config.yml
```

- クラスターの作成状況は下記コマンドから確認できます

```sh
pcluster list-clusters
```
```
Output:
{
  "clusters": [
    {
      "clusterName": "hpcclustercolab",
      ## CREATE_COMPLETE になればクラスター作成完了
      "cloudformationStackStatus": "CREATE_COMPLETE",
...
```

### 3. ウェブフロントエンドの構築

```sh
## 下記コマンドでクラスターの HeadNode のインスタンス ID を取得
pcluster describe-cluster -n hpccluster | grep -A 5 headNode | grep instanceId
"instanceId": "i-{任意のID}",
```

- `provisioning/bin/provisioning.ts` にある `ssmInstanceId` の値を上記インスタンス ID に修正

```diff
-  ssmInstanceId: 'your-headnode-instanceid',
+  ssmInstanceId: 'i-{任意のID}',
```

- 修正後、フロントエンドをデプロイ

```sh
## フロントエンドのデプロイ
cd provisioning
npx cdk deploy FrontendStack --require-approval never
```

- `cdk deploy` の Outputs にある `CloudFrontWebDistributionEndpoint` の値がフロントエンドの URL になります

### 4. HeadNode の構築

```sh
## 秘密鍵を使用して ParallelCluster の HeadNode に SSH ログイン
export AWS_DEFAULT_REGION=us-east-1
pcluster ssh --cluster-name hpccluster -i ~/.ssh/keypair-alphafold2.pem
```

- HeadNode にログインして、ColabFold もしくは AlphaFold2 をインストール
  - ColabFold と AlphaFold2 の両方のコマンドの記載がありますが、ご利用になる方どちらかを選んで実行してください。

```sh
## HeadNode にログイン後、ColabFold をインストール
### ColabFold の場合
bash /fsx/colabfold/scripts/bin/app_install.sh
### AlphaFold2 の場合
bash /fsx/alphafold2/scripts/bin/app_install.sh

## データベースの作成
### ColabFold の場合
sbatch /fsx/colabfold/scripts/setupDatabase.bth
### AlphaFold2 の場合
bash /fsx/alphafold2/scripts/bin/setup_database.sh
```

### 5. バックエンドの動作確認

- ParallelCluster の HeadNode から下記コマンドでジョブを投入

```
wget -q -P /fsx/colabfold/job/input/ https://rest.uniprot.org/uniprotkb/Q5VSL9.fasta
python3 /fsx/colabfold/scripts/job_create.py Q5VSL9.fasta
```

```sh
## squeue コマンドで実行中のジョブを確認
squeue
             JOBID PARTITION     NAME     USER ST       TIME  NODES NODELIST(REASON)
                 1 queue-cpu setupDat   ubuntu CF       0:03      1 queue-cpu-dy-x2iedn16xlarge-1
```

```sh
## 完了するとジョブが表示されなくなる
squeue
             JOBID PARTITION     NAME     USER ST       TIME  NODES NODELIST(REASON)
```

### 6. フロントエンドの動作確認

- 手順3 で取得したフロントエンドの URL に、ブラウザから接続します。
  - もし URL を忘れてしまった場合は、[AWS Cloudformation のコンソール](https://us-east-1.console.aws.amazon.com/cloudformation) の`FrontendStack` の `出力` タブを見ると、`CloudFrontWebDistributionEndpoint` の値に記載されています。
  - 値は `xxxyyyzzz.cloudfront.net` のような形式です。
- フロントエンドの画面か、ジョブの投入・ジョブ一覧の表示・ジョブの中止・ジョブの結果表示が行えます。

