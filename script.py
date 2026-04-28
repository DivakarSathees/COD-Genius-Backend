import sys

def reverse_summary(summary):
    words = summary.split()
    reversed_summary = ' '.join(words)
    return reversed_summary

def main():
    try:
        summary = sys.stdin.readline().strip()
        if not summary or len(summary) < 250:
            print('Invalid input')
        else:
            print(reverse_summary(summary))
    except Exception as e:
        pass

if __name__ == '__main__':
    main()