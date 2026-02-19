#!/bin/bash

# Create S3 bucket for documents
awslocal s3 mb s3://voms-documents

# Set bucket policy
awslocal s3api put-bucket-policy --bucket voms-documents --policy '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": "*",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::voms-documents/*"
    }
  ]
}'

echo "LocalStack initialization complete"
