import { buildClient, CommitmentPolicy, KmsKeyringNode } from '@aws-crypto/client-node';
import { toByteArray } from 'base64-js';
import { CustomEmailSenderTriggerEvent } from 'aws-lambda';
import sendgrid from '@sendgrid/mail';
import { MailDataRequired } from '@sendgrid/helpers/classes/mail';
import { StringMap } from 'aws-lambda/trigger/cognito-user-pool-trigger/_common';

async function getPlainTextCode(event: CustomEmailSenderTriggerEvent) {
    if (!event.request.code) {
        if (event.triggerSource == 'PostAuthentication_Authentication') {
            return "";
        } else {
            throw Error('Could not find code');
        }
    }

    if (!process.env.KEY_ID) {
        throw Error('Cannot decrypt code');
    }

    const client = buildClient(CommitmentPolicy.REQUIRE_ENCRYPT_ALLOW_DECRYPT);
    const generatorKeyId = process.env.KEY_ALIAS;
    const keyIds = [process.env.KEY_ID];
    const keyring = new KmsKeyringNode({ generatorKeyId, keyIds });

    let plainTextCode: string | undefined = undefined;
    const decryptOutput = await client.decrypt(keyring, toByteArray(event.request.code));
    plainTextCode = decryptOutput.plaintext.toString();

    return plainTextCode;
}

function createMessageObject(toEmail: string, userName: string, templateId: string, subject: string, password: string): MailDataRequired {
    if (!process.env.FROM_EMAIL) {
        throw Error('From email not found');
    }

    let br_date_string = new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
    let today = new Date(br_date_string);
    let day = String(today.getDate()).padStart(2, '0');
    let month = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
    let year = today.getFullYear();
    let hours = String(today.getHours()).padStart(2, '0');
    let minutes = String(today.getMinutes()).padStart(2, '0');

    return {
        from: process.env.FROM_EMAIL,
        subject: subject,
        personalizations: [
            {
                to: [
                    {
                        email: toEmail
                    }
                ],
                dynamicTemplateData: {
                    name: userName,
                    email: toEmail,
                    password: password,
                    date: day + '/' + month + '/' + year,
                    time: hours + ':' + minutes
                }
            }
        ],
        templateId: templateId
    };
}

function generateMessageToSend(event: CustomEmailSenderTriggerEvent, plainTextCode: string, toEmail: string, userName: string) {
    let templateId = '';
    let subject = '';

    if (!(process.env.SIGN_UP_TEMPLATE_ID && process.env.SIGN_UP_SUBJECT)) {
        throw Error('Data to create sign up email is missing');
    }

    if (!(process.env.FORGOT_PASSWORD_TEMPLATE_ID && process.env.FORGOT_PASSWORD_SUBJECT)) {
        throw Error('Data to create forgot password email is missing');
    }

    if (!(process.env.LOGIN_TEMPLATE_ID && process.env.LOGIN_SUBJECT)) {
        throw Error('Data to create sign up email is missing');
    }

    const maskedEmail = toEmail.replace(/^(.)(.*)(.@.*)$/, (_, a, b, c) => a + b.replace(/./g, '*') + c);

    if (event.triggerSource == 'CustomEmailSender_AdminCreateUser') {
        console.info(`Sending admin create user email to ${maskedEmail}`);
        templateId = process.env.SIGN_UP_TEMPLATE_ID;
        subject = process.env.SIGN_UP_SUBJECT;        
    } else if (event.triggerSource == 'CustomEmailSender_SignUp') {
        console.info(`Sending sign up email to ${maskedEmail}`);
        templateId = process.env.SIGN_UP_TEMPLATE_ID;
        subject = process.env.SIGN_UP_TEMPLATE_ID;
    } else if (event.triggerSource == 'CustomEmailSender_ForgotPassword') {
        console.info(`Sending forgotten password email to ${maskedEmail}`);
        templateId = process.env.FORGOT_PASSWORD_TEMPLATE_ID;
        subject = process.env.FORGOT_PASSWORD_SUBJECT;
    } else if(event.triggerSource == 'CustomEmailSender_ResendCode'){
        console.info(`Sending resend code email to ${maskedEmail}`);
        templateId = process.env.FORGOT_PASSWORD_TEMPLATE_ID;
        subject = process.env.FORGOT_PASSWORD_SUBJECT;
    } else if (event.triggerSource == 'PostAuthentication_Authentication') {
        console.info(`Sending login notification to ${maskedEmail}`);
        templateId = process.env.LOGIN_TEMPLATE_ID;
        subject = process.env.LOGIN_SUBJECT;
    } else {
        console.info(`Unhandled event type: ${event.triggerSource}`);
        return;
    }

    return createMessageObject(toEmail, userName, templateId, subject, plainTextCode);
}

export async function handler(event: CustomEmailSenderTriggerEvent): Promise<CustomEmailSenderTriggerEvent> {
    console.log("ENVIRONMENT VARIABLES\n" + JSON.stringify(process.env, null, 2))
    console.info("EVENT\n" + JSON.stringify(event, null, 2))

    if (!process.env.SENDGRID_API_KEY) {
        throw Error('Sendgrid API key not found');
    }

    sendgrid.setApiKey(process.env.SENDGRID_API_KEY);

    const plainTextCode = await getPlainTextCode(event);
    const toEmail = (event.request.userAttributes as StringMap)['email'];
    const userName = (event.request.userAttributes as StringMap)['name'];
    const messageToSend: MailDataRequired | undefined = generateMessageToSend(event, plainTextCode, toEmail, userName);

    if (messageToSend) {
        console.info("Message to send:\n" + JSON.stringify(messageToSend, null, 2));
        const response = await sendgrid.send(messageToSend);
        console.info(`Response Code: ${response[0].statusCode}, Message-ID: ${response[0].headers['x-message-id']}, Body: ${response[0].body}}`);
    }

    return event;
}
