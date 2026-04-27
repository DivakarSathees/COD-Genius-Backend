import sys

def reverse_description(description):
    words = description.split()
    reversed_description = ' '.join(reversed(words))
    return reversed_description

def main():
    try:
        description = sys.stdin.readline().strip()
        if not description or len(description) > 250:
            print("Invalid input")
        else:
            print(reverse_description(description))
    except Exception as e:
        pass

if __name__ == '__main__':
    main()