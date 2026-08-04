Runs fully synchronously inside the HTTP request. A slow or hanging external API stretches the whole request toward the 90s client timeout; there is no background queue to absorb it.
