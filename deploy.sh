npm run build
aws s3 cp dist/lambda.zip s3://radar-static-files/lambda/cognito-custom-email-sender/lambda.zip
aws lambda update-function-code --function-name cognito-custom-email-sender --s3-bucket radar-static-files --s3-key lambda/cognito-custom-email-sender/lambda.zip