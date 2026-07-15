FROM postgres:18.4-alpine3.24@sha256:9a8afca54e7861fd90fab5fdf4c42477a6b1cb7d293595148e674e0a3181de15

RUN apk add --no-cache \
      age=1.3.1-r5 \
      aws-cli=2.34.63-r0 \
      coreutils=9.11-r0 \
      jq=1.8.1-r0 \
      pgbackrest=2.58.0-r0 \
      rclone=1.74.1-r1 \
      util-linux=2.42.1-r0 \
  && install -d -o postgres -g postgres -m 0700 \
      /run/postgres-backup /var/lib/pgbackrest /var/log/pgbackrest \
      /var/spool/pgbackrest /var/lib/postgres-backup/state \
      /var/lib/postgres-backup/stage \
  && install -d -o root -g root -m 0755 \
      /etc/postgres-backup

COPY --chmod=0755 infra/docker/postgres/scripts/ /usr/local/bin/postgres-backup/
COPY --chmod=0644 infra/docker/postgres/config/backup-schedule.cron \
  /etc/postgres-backup/backup-schedule.cron

ENTRYPOINT ["/usr/local/bin/postgres-backup/postgres-entrypoint.sh"]
CMD ["postgres"]
