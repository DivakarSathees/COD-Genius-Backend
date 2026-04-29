import sys

def get_reversed_message(message):
    if not message or message.isspace() or len(message) >= 250:
        return "Invalid input"
    words = message.split(' ')
    if not words:
        return "Invalid input"
    return "Reversed: " + " ".join(words)

if __name__ == "__main__":
    line = sys.stdin.readline()
    if line.endswith('\n'):
        line = line[:-1]
    if line.endswith('\r'):
        line = line[:-1]
    result = get_reversed_message(line)
    print(result)