import sys

def reverse_quote(quote):
    if quote is None or len(quote) >= 256:
        return "Invalid input"
    words = quote.split()
    reversed_words = ' '.join(reversed(words[1:]))
    return reversed_words

if __name__ == '__main__':
    quote = sys.stdin.read().strip()
    result = reverse_quote(quote)
    print(result)
