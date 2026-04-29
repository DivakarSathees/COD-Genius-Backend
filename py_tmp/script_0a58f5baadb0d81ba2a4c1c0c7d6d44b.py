import sys

def get_reversed_reminder(reminder_text):
    if len(reminder_text) < 1 or len(reminder_text) > 250 or reminder_text.isspace():
        return "Invalid input"
    words = reminder_text.split()
    if not words:
        return "Invalid input"
    words.reverse()
    reversed_string = " ".join(words)
    return "Reversed: " + reversed_string

if __name__ == "__main__":
    user_input = sys.stdin.readline().replace("\n", "").replace("\r", "")
    final_output = get_reversed_reminder(user_input)
    sys.stdout.write(final_output + "\n")