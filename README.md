# AlphaFold2 Service

<img src="doc/architecture.png" width=500>

## 事前準備

- [AWS CLI のインストール](https://docs.aws.amazon.com/ja_jp/cli/latest/userguide/install-cliv2.html) および [認証情報の設定](https://docs.aws.amazon.com/ja_jp/cli/latest/userguide/cli-configure-files.html)
- [Python 3](https://www.python.org/about/) のインストール
- [Node.js LTS](https://nodejs.org/en/) のインストール
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) のインストール

## TIPS: AWS Cloud9 環境の簡易構築

1. AWS CloudShell を起動して下記コマンドを実行

```sh
git clone https://github.com/aws-samples/cloud9-setup-for-prototyping
cd cloud9-setup-for-prototyping

## Cloud9 環境 "cloud9-for-prototyping" を構築します
./bin/bootstrap
```

2. AWS Cloud9 に移動して `cloud9-for-prototyping` を起動
3. `File` から `Upload Local Files` を押下
4. 本リポジトリのソース zip ファイルを `Drag & drop file here ` に投下
5. `unzip` コマンドで zip を解凍してディレクトリを移動

```sh
Admin:~/environment $ unzip your_samples.zip
Admin:~/environment $ cd your_samples/
```

**NOTE:** 上記方法で構築した Cloud9 環境の場合、事前準備に記載した AWS CLI / Python / Node.js / Docker は導入済みのため不要です

## デプロイ手順

**NOTE:** 以降の手順は、上記 Cloud9 環境からの作業を推奨します

### 1. バックエンドの構築

```sh
cd provisioning
npm install
npx cdk bootstrap
## Network, Database, Storage などの構築
npx cdk deploy Alphafold2ServiceStack --require-approval never
cd ../
```

### 2. 秘密鍵の保存

上記 CDK の Outputs から Alphafold2ServiceStack.GetSSHKeyCommand の値 `aws ssm get-parameter...` をコピー＆実行して秘密鍵を保存

```sh
aws ssm get-parameter --name /ec2/keypair/key-{任意のID} --region us-east-1 --with-decryption --query Parameter.Value --output text > ~/.ssh/keypair-alphafold2.pem

## 権限の変更
chmod 600 ~/.ssh/keypair-alphafold2.pem
```

### 3. ParallelCluster クラスターの作成

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

**NOTE:** クラスターの作成状況は下記コマンドから確認できます

```sh
pcluster list-clusters
{
  "clusters": [
    {
      "clusterName": "hpcclustercolab",
      ## CREATE_COMPLETE になればクラスター作成完了
      "cloudformationStackStatus": "CREATE_COMPLETE",
...
```

### 4. ウェブフロントエンドの構築

```sh
## 下記コマンドでクラスターの HeadNode のインスタンス ID を取得
pcluster describe-cluster -n hpccluster | grep -A 5 headNode | grep instanceId
"instanceId": "i-{任意のID}",
```

`provisioning/bin/provisioning.ts` にある `ssmInstanceId` の値を上記インスタンス ID に修正

```diff
-  ssmInstanceId: 'your-headnode-instanceid',
+  ssmInstanceId: 'i-{任意のID}',
```

修正後、フロントエンドをデプロイ

```sh
## フロントエンドのビルド
cd app
npm install
npm run build

## フロントエンドのデプロイ
cd ../provisioning
npx cdk deploy FrontendStack --require-approval never
```

**NOTE:** `cdk deploy` の Outputs にある `CloudFrontWebDistributionEndpoint` の値がフロントエンドの URL になります

### 5. HeadNode の構築

```sh
## 秘密鍵を使用して ParallelCluster の HeadNode に SSH ログイン
export AWS_DEFAULT_REGION=us-east-1
pcluster ssh --cluster-name hpccluster -i ~/.ssh/keypair-alphafold2.pem
```

#### 5a. ColabFold の場合

```sh
## HeadNode にログイン後、ColabFold をインストール
bash /fsx/colabfold/scripts/bin/app_install.sh

## データベースの作成
sbatch /fsx/colabfold/scripts/setupDatabase.bth
```

#### 5b. AlphaFold2 の場合

```sh
## HeadNode にログイン後、AlphaFold2 に必要なコードをダウンロード
bash /fsx/alphafold2/scripts/bin/app_install.sh

## データベースの作成（ダウンロードに数時間かかる）
## コマンド実行開始後、terminal を閉じても問題ない
bash /fsx/alphafold2/scripts/bin/setup_database.sh
```

---

## バックエンドの動作確認

ParallelCluster の HeadNode から下記コマンドでジョブを投入

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

## フロントエンドの動作確認

`4.` の `CloudFrontWebDistributionEndpoint` にブラウザから接続します

```sh
Outputs:
    FrontendStack-dev.CloudFrontWebDistributionEndpoint = {任意のID}.cloudfront.net
```

ジョブの投入・ジョブ一覧の表示・ジョブの中止・ジョブの結果表示が行えます

<img src="doc/webui.png" width=500>
