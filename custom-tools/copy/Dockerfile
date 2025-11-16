FROM alpine:latest

# Install bash for the script
RUN apk add --no-cache bash

# Copy the script
COPY copy.sh /usr/local/bin/copy.sh
RUN chmod +x /usr/local/bin/copy.sh

# Set the entrypoint
ENTRYPOINT ["/usr/local/bin/copy.sh"]

