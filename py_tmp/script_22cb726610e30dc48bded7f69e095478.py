import sys

def get_reversed_reminder(s):
    if not (1 <= len(s) <= 250) or s.isspace():
        return "Invalid input"
    words = s.split()
    if not words:
        return "Invalid input"
    reversed_sentence = " ".join(words[::-1])
    return "Reversed: " + reversed_sentence

if __name__ == '__main__':
    input_data = sys.stdin.readline().rstrip('\r\n')
    result = get_reversed_reminder(input_data)
    print(result)