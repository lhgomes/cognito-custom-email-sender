#!/bin/bash
set -e

LAMBDA_CUSTOM_SENDER_NAME="radar-cognito-custom-email-sender"
LAMBDA_CUSTOM_SENDER_ARN=$(aws lambda get-function --function-name "$LAMBDA_CUSTOM_SENDER_NAME" | jq -r -c '.Configuration | .FunctionArn')

LAMBDA_POST_AUTHENTICATION_NAME="radar-cognito-custom-email-sender"
LAMBDA_POST_AUTHENTICATION_ARN=$(aws lambda get-function --function-name "$LAMBDA_POST_AUTHENTICATION_NAME" | jq -r -c '.Configuration | .FunctionArn')

LAMBDA_POST_CONFIRMATION_NAME="radar-cognito-postconfirmation"
LAMBDA_POST_CONFIRMATION_ARN=$(aws lambda get-function --function-name "$LAMBDA_POST_CONFIRMATION_NAME" | jq -r -c '.Configuration | .FunctionArn')

LAMBDA_PRE_TOKEN_NAME="radar-cognito-pretokengeneration"
LAMBDA_PRE_TOKEN_ARN=$(aws lambda get-function --function-name "$LAMBDA_PRE_TOKEN_NAME" | jq -r -c '.Configuration | .FunctionArn')

KMS_KEY_ALIAS="radar-cognito-custom-email-sender"
KMS_KEY_ID=$(aws kms list-aliases | jq -r -c '.Aliases[] | select(.AliasName | contains("'$KMS_KEY_ALIAS'")) | .TargetKeyId')
KMS_KEY_ARN=$(aws kms describe-key --key-id $KMS_KEY_ID | jq -r -c '.KeyMetadata | .Arn')

LAMBDA_CONFIG="CustomEmailSender={LambdaVersion=V1_0,LambdaArn=$LAMBDA_CUSTOM_SENDER_ARN},PostAuthentication=$LAMBDA_POST_AUTHENTICATION_ARN,PostConfirmation=$LAMBDA_POST_CONFIRMATION_ARN,PreTokenGeneration=$LAMBDA_PRE_TOKEN_ARN,KMSKeyID=$KMS_KEY_ARN"

USER_POOL_NAME="cog-app-radar-user-pool"
echo "Looking for userpool: $USER_POOL_NAME"
USER_POOL_ID=$(aws cognito-idp list-user-pools --max-results 10 | jq -r -c '.UserPools[] | select(.Name | contains("'$USER_POOL_NAME'")) | .Id')

echo "Lambda config:"
echo $LAMBDA_CONFIG

echo "Updating user-pool '$USER_POOL_ID' for lambda '$LAMBDA_CUSTOM_SENDER_ARN'"
aws cognito-idp update-user-pool --user-pool-id $USER_POOL_ID --lambda-config $LAMBDA_CONFIG --auto-verified-attributes "email"

echo "Describing user-pool"
aws cognito-idp list-user-pools --max-results 10 | jq '.UserPools[] | select(.Name | contains("'$USER_POOL_NAME'"))'