# Accounts and reset email

The homepage and checkout open the same real account form in a compact, same-origin popup. Sign in and Create account are separate tabs. Existing customer accounts and admin credentials continue working. Checkout keeps entered delivery fields when the popup closes after login. The standalone account page still supports order history, saved addresses and password reset.

## Sending reset links

The reset API queues a single-use, 30-minute link. It never discloses whether an email exists. A separate email worker now sends only `auth.reset` jobs over authenticated TLS SMTP. It does not consume order/WhatsApp notification jobs. Acceptance by SMTP is not proof of inbox delivery; check delivery and spam folders on staging.

1. In the private backend directory, copy `config/mail.example.php` to `config/mail.local.php` and set file permissions to 600. This file must stay outside public_html and GitHub.
2. Enter the mailbox SMTP host, port (465 or 587), username, password and sender email. Use the mailbox provider's actual settings. Set `base_url` in private `config/local.php` to `https://staging.yuganth.com` while testing; it controls the reset link. Update to the live domain at launch.
3. A Gmail sender needs an eligible Google account with 2-Step Verification and an app password, not the ordinary Google password. Alternatively use an existing Hostinger mailbox. Do not paste passwords into chat.
4. Run the worker once after requesting a reset:

```sh
cd /home/u322658527/domains/yuganth.com/yuganth-app
/opt/alt/php83/usr/bin/php bin/reset-emails.php
```

5. Add a Hostinger cron job every minute using that absolute PHP binary and the absolute path to `bin/reset-emails.php`. The worker uses a file lock. Failed deliveries retry up to 10 batches; expired jobs are discarded. Do not run the generic outbox worker with an adapter that also sends reset emails at the same time.
6. Test a real reset email, verify the staging link, change password, then confirm the link cannot be reused. No real email has been sent by the automated tests.

Google app passwords: https://support.google.com/accounts/answer/185833

## Continue with Google

Google sign-in is not enabled in this update. Customers can already register with their Gmail address using an ordinary website password. Google sign-in requires a Google Cloud web OAuth client ID and authorized website origins, then a server integration that validates Google tokens and links accounts safely. Never link an existing administrator by email alone or trust a browser-supplied email as proof of identity.

Create the Google web client for the staging and live origins when ready. No decorative Google button is shown until the integration exists.

Official setup: https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid
