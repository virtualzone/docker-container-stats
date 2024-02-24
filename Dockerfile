FROM alpine:3.19
ARG BUILD_DATE
ARG VCS_REF
LABEL org.label-schema.build-date=$BUILD_DATE \
        org.label-schema.name="Docker Container Stats" \
        org.label-schema.description="Monitor your docker containers with this web interface." \
        org.label-schema.vcs-ref=$VCS_REF \
        org.label-schema.vcs-url="https://github.com/virtualzone/docker-container-stats" \
        org.label-schema.schema-version="1.0"

RUN apk --update add --no-cache \
    supervisor \
    nodejs \
    npm \
    docker \
    sqlite

RUN mkdir -p /opt/docker-stats/db
RUN apk --update add --no-cache --virtual .build-deps \
    make python3 gcc g++ libc-dev && \
    cd /opt/docker-stats && \
    npm update && \
    npm install express sqlite3 body-parser moment --build-from-source=sqlite3 && \
    apk del .build-deps

ADD stats.js /opt/docker-stats/
ADD httpd.js /opt/docker-stats/
ADD html/ /opt/docker-stats/html/
ADD supervisord.conf /etc/supervisord.conf

EXPOSE 8080
CMD ["/usr/bin/supervisord"]
