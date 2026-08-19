FROM searxng/searxng:latest

USER root
COPY settings.yml /etc/searxng/settings.yml
COPY gateway.py /usr/local/searxng/gateway.py
COPY start.sh /usr/local/searxng/search-gateway-start.sh
RUN chmod 755 /usr/local/searxng/search-gateway-start.sh

ENV GRANIAN_HOST=127.0.0.1 \
    GRANIAN_PORT=8080 \
    GATEWAY_PORT=10000

EXPOSE 10000
USER 977:977
ENTRYPOINT ["/usr/local/searxng/search-gateway-start.sh"]
